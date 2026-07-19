import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auditExternalQuality, externalQualityContext, externalQualityError } from '@/lib/external-quality/access'
import { resultPayload } from '@/lib/eqa/api'
import { resultSchema } from '@/lib/eqa/schemas'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }
const schema = z.object({ results: z.array(resultSchema).min(1) })

export async function PUT(req: NextRequest, { params }: Params) {
  const ctx = await externalQualityContext('eqa', true)
  if (ctx.response) return ctx.response
  try {
    const { id } = await params
    const input = schema.parse(await req.json())
    const { data: round, error: roundError } = await supabaseAdmin.from('eqa_rounds').select('program_id,status').eq('id', id).single()
    if (roundError) throw roundError
    if (!['submitted', 'reviewed', 'capa_open'].includes(round.status)) {
      return NextResponse.json({ error: 'บันทึกผลได้หลังส่งผลเข้าสู่สถานะ submitted แล้ว' }, { status: 422 })
    }
    const requestedTestIds = [...new Set(input.results.map(result => result.programTestId))]
    const { data: validTests, error: testsError } = await supabaseAdmin
      .from('eqa_program_tests').select('id').eq('program_id', round.program_id).eq('active', true).in('id', requestedTestIds)
    if (testsError) throw testsError
    if ((validTests?.length ?? 0) !== requestedTestIds.length) {
      return NextResponse.json({ error: 'มีรายการผลที่ไม่ได้อยู่ในโครงการของรอบนี้' }, { status: 422 })
    }
    const payload = input.results.map(result => ({ ...resultPayload(id, result, ctx.actor!.id), created_by: ctx.actor!.id }))
    const { error } = await supabaseAdmin.from('eqa_round_results').upsert(payload, { onConflict: 'round_id,program_test_id,sample_code' })
    if (error) throw error
    const { count: failureCount, error: failureError } = await supabaseAdmin
      .from('eqa_round_results').select('id', { count: 'exact', head: true }).eq('round_id', id).eq('outcome', 'unacceptable')
    if (failureError) throw failureError
    const { error: updateError } = await supabaseAdmin
      .from('eqa_rounds')
      .update({ status: failureCount ? 'capa_open' : 'reviewed', updated_at: new Date().toISOString(), updated_by: ctx.actor!.id })
      .eq('id', id)
      .neq('status', 'closed')
    if (updateError) throw updateError
    await auditExternalQuality('eqa', 'result.upsert', ctx.actor!.id, id, `${input.results.length} results`)
    return NextResponse.json({ success: true })
  } catch (error) {
    return externalQualityError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await externalQualityContext('eqa', true)
  if (ctx.response) return ctx.response
  try {
    const { id: roundId } = await params
    const resultId = z.string().uuid().parse(req.nextUrl.searchParams.get('resultId'))
    const { data: round, error: roundError } = await supabaseAdmin.from('eqa_rounds').select('status').eq('id', roundId).single()
    if (roundError) throw roundError
    if (round.status === 'closed') return NextResponse.json({ error: 'ไม่สามารถลบผลจากรอบที่ปิดแล้ว' }, { status: 422 })
    const { count: capaLinks, error: linksError } = await supabaseAdmin
      .from('eqa_capa_results').select('*', { count: 'exact', head: true }).eq('result_id', resultId)
    if (linksError) throw linksError
    if (capaLinks) return NextResponse.json({ error: 'ไม่สามารถลบผลที่ผูกกับ CAPA ได้' }, { status: 422 })
    const { data: result, error: deleteError } = await supabaseAdmin
      .from('eqa_round_results').delete().eq('id', resultId).eq('round_id', roundId).select('id').single()
    if (deleteError) throw deleteError
    const { count: failureCount, error: failureError } = await supabaseAdmin
      .from('eqa_round_results').select('id', { count: 'exact', head: true }).eq('round_id', roundId).eq('outcome', 'unacceptable')
    if (failureError) throw failureError
    const { error: updateError } = await supabaseAdmin
      .from('eqa_rounds').update({ status: failureCount ? 'capa_open' : 'reviewed', updated_at: new Date().toISOString(), updated_by: ctx.actor!.id }).eq('id', roundId)
    if (updateError) throw updateError
    await auditExternalQuality('eqa', 'result.delete', ctx.actor!.id, result.id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return externalQualityError(error)
  }
}
