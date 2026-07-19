import { NextRequest, NextResponse } from 'next/server'
import { auditExternalQuality, externalQualityContext, externalQualityError } from '@/lib/external-quality/access'
import { capaUpdateSchema } from '@/lib/eqa/schemas'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await externalQualityContext('eqa', true)
  if (ctx.response) return ctx.response
  try {
    const { id } = await params
    const input = capaUpdateSchema.parse(await req.json())
    const { data: current, error: currentError } = await supabaseAdmin.from('eqa_capas').select('round_id,status').eq('id', id).single()
    if (currentError) throw currentError
    if (input.status === 'completed' && current.status !== 'open') {
      return NextResponse.json({ error: 'CAPA ต้องอยู่สถานะ open ก่อนบันทึกว่าเสร็จ' }, { status: 422 })
    }
    if (input.status === 'verified' && current.status !== 'completed') {
      return NextResponse.json({ error: 'CAPA ต้องดำเนินการเสร็จก่อนทวนสอบ' }, { status: 422 })
    }
    if (input.status === 'verified' && !input.effectivenessResult?.trim()) {
      return NextResponse.json({ error: 'ต้องบันทึกผลทวนสอบประสิทธิผลก่อนยืนยัน CAPA' }, { status: 422 })
    }
    if (input.resultIds) {
      const { data: results, error } = await supabaseAdmin
        .from('eqa_round_results').select('id').eq('round_id', current.round_id).eq('outcome', 'unacceptable').in('id', input.resultIds)
      if (error) throw error
      if ((results ?? []).length !== new Set(input.resultIds).size) {
        return NextResponse.json({ error: 'CAPA ผูกได้เฉพาะผล unacceptable ของรอบเดียวกัน' }, { status: 422 })
      }
    }
    const now = new Date().toISOString()
    const payload: Record<string, unknown> = { updated_at: now, updated_by: ctx.actor!.id }
    if (input.status) payload.status = input.status
    if (input.title) payload.title = input.title
    if (input.rootCause) payload.root_cause = input.rootCause
    if (input.immediateCorrection !== undefined) payload.immediate_correction = input.immediateCorrection
    if (input.correctiveAction) payload.corrective_action = input.correctiveAction
    if (input.ownerId) payload.owner_id = input.ownerId
    if (input.dueOn) payload.due_on = input.dueOn
    if (input.effectivenessResult !== undefined) payload.effectiveness_result = input.effectivenessResult
    if (input.status === 'completed') Object.assign(payload, { completed_at: now, completed_by: ctx.actor!.id })
    if (input.status === 'verified') Object.assign(payload, { verified_at: now, verified_by: ctx.actor!.id })
    const { data, error } = await supabaseAdmin.from('eqa_capas').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    if (input.resultIds) {
      const { error: deleteError } = await supabaseAdmin.from('eqa_capa_results').delete().eq('capa_id', id)
      if (deleteError) throw deleteError
      const { error: linkError } = await supabaseAdmin.from('eqa_capa_results').insert(input.resultIds.map(resultId => ({ capa_id: id, result_id: resultId })))
      if (linkError) throw linkError
    }
    await auditExternalQuality('eqa', 'capa.update', ctx.actor!.id, id, data.status)
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
    const { error } = await supabaseAdmin.from('eqa_capas').delete().eq('id', id).eq('status', 'open')
    if (error) throw error
    await auditExternalQuality('eqa', 'capa.delete', ctx.actor!.id, id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return externalQualityError(error)
  }
}
