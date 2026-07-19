import { NextRequest, NextResponse } from 'next/server'
import { auditExternalQuality, externalQualityContext, externalQualityError } from '@/lib/external-quality/access'
import { roundPayload } from '@/lib/eqa/api'
import { canTransitionEqaRound, roundClosureBlockers, type EqaRoundStatus } from '@/lib/eqa/domain'
import { roundSchema } from '@/lib/eqa/schemas'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

async function closureBlockers(roundId: string) {
  const { data: round, error: roundError } = await supabaseAdmin
    .from('eqa_rounds')
    .select('id,program_id,round_code,status')
    .eq('id', roundId)
    .single()
  if (roundError) throw roundError

  const [tests, results, reports, capas] = await Promise.all([
    supabaseAdmin.from('eqa_program_tests').select('id', { count: 'exact', head: true }).eq('program_id', round.program_id).eq('active', true),
    supabaseAdmin.from('eqa_round_results').select('id,outcome').eq('round_id', roundId),
    supabaseAdmin.from('eqa_attachments').select('id', { count: 'exact', head: true }).eq('round_id', roundId).eq('attachment_kind', 'provider_report'),
    supabaseAdmin.from('eqa_capas').select('id,status').eq('round_id', roundId),
  ])
  for (const result of [tests, results, reports, capas]) if (result.error) throw result.error

  const unacceptableResultIds = (results.data ?? [])
    .filter(result => result.outcome === 'unacceptable')
    .map(result => String(result.id))
  const verifiedCapaIds = (capas.data ?? [])
    .filter(capa => capa.status === 'verified')
    .map(capa => String(capa.id))
  let resolvedUnacceptableResultIds: string[] = []
  if (verifiedCapaIds.length) {
    const { data: links, error } = await supabaseAdmin
      .from('eqa_capa_results')
      .select('result_id')
      .in('capa_id', verifiedCapaIds)
    if (error) throw error
    const unacceptable = new Set(unacceptableResultIds)
    resolvedUnacceptableResultIds = (links ?? [])
      .map(link => String(link.result_id))
      .filter(resultId => unacceptable.has(resultId))
  }

  return {
    round,
    blockers: roundClosureBlockers({
      expectedResultCount: tests.count ?? 0,
      recordedResultCount: results.data?.length ?? 0,
      reportAttachmentCount: reports.count ?? 0,
      unacceptableResultIds,
      resolvedUnacceptableResultIds,
    }),
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await externalQualityContext('eqa', true)
  if (ctx.response) return ctx.response
  try {
    const { id } = await params
    const body = await req.json()
    if (body.action === 'close') {
      const check = await closureBlockers(id)
      if (!['reviewed', 'capa_open'].includes(check.round.status)) {
        return NextResponse.json({ error: 'รอบต้องผ่านการส่งผลและทบทวนก่อนปิด' }, { status: 422 })
      }
      if (check.blockers.length) {
        return NextResponse.json({ error: 'ยังปิดรอบไม่ได้', blockers: check.blockers }, { status: 422 })
      }
      const now = new Date().toISOString()
      const { data, error } = await supabaseAdmin
        .from('eqa_rounds')
        .update({ status: 'closed', closed_at: now, closed_by: ctx.actor!.id, updated_at: now, updated_by: ctx.actor!.id })
        .eq('id', id)
        .neq('status', 'closed')
        .select('*')
        .single()
      if (error) throw error
      await auditExternalQuality('eqa', 'round.close', ctx.actor!.id, id, check.round.round_code)
      return NextResponse.json(data)
    }

    const input = roundSchema.parse(body)
    if (input.status === 'closed') return NextResponse.json({ error: 'กรุณาใช้คำสั่ง close ที่ตรวจเงื่อนไขการปิดรอบ' }, { status: 422 })
    const { data: current, error: currentError } = await supabaseAdmin.from('eqa_rounds').select('status').eq('id', id).single()
    if (currentError) throw currentError
    if (!canTransitionEqaRound(current.status as EqaRoundStatus, input.status)) {
      return NextResponse.json({ error: `เปลี่ยนสถานะ ${current.status} → ${input.status} ไม่ได้` }, { status: 422 })
    }
    const { data, error } = await supabaseAdmin
      .from('eqa_rounds')
      .update(roundPayload(input, ctx.actor!.id))
      .eq('id', id)
      .neq('status', 'closed')
      .select('*')
      .single()
    if (error) throw error
    await auditExternalQuality('eqa', 'round.update', ctx.actor!.id, id, data.round_code)
    return NextResponse.json(data)
  } catch (error) {
    return externalQualityError(error)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await externalQualityContext('eqa', true)
  if (ctx.response) return ctx.response
  try {
    const { id } = await params
    const { error } = await supabaseAdmin.from('eqa_rounds').delete().eq('id', id).eq('status', 'planned')
    if (error) throw error
    await auditExternalQuality('eqa', 'round.delete', ctx.actor!.id, id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return externalQualityError(error)
  }
}
