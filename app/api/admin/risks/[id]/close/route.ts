import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canReviewRisk, getRiskActor } from '@/lib/risk-server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReviewRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const riskId = Number(id)
  const [{ data: risk, error }, { data: actions }] = await Promise.all([
    supabaseAdmin.from('risks').select('*').eq('id', riskId).single(),
    supabaseAdmin.from('risk_actions').select('*').eq('risk_id', riskId),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  if (!risk.residual_likelihood || !risk.residual_impact) {
    return NextResponse.json({ error: 'ต้องประเมิน Residual Risk ก่อนปิดประเด็น' }, { status: 422 })
  }
  const openActions = (actions ?? []).filter(action => action.status !== 'done')
  if (openActions.length > 0) {
    return NextResponse.json({ error: 'ยังมี action plan ที่ยังไม่เสร็จ' }, { status: 422 })
  }
  if (!risk.effectiveness_result) {
    return NextResponse.json({ error: 'ต้องบันทึกผลการติดตามประสิทธิผลก่อนปิดประเด็น' }, { status: 422 })
  }

  const { data, error: updateError } = await supabaseAdmin
    .from('risks')
    .update({
      status: 'closed',
      review_status: 'closed',
      closed_by: actor.name ?? actor.role,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', riskId)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json(data)
}
