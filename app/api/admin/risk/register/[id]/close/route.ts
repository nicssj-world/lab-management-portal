import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditRisk, canReviewRisk, getRiskActor } from '@/lib/risk/access'

/**
 * ปิดรายการในทะเบียนความเสี่ยง (ISO 15189 8.5)
 *
 * เดิมไม่มีทางไปถึงสถานะ 'closed' เลย — syncRegisterStatus (register actions route)
 * พาไปได้ไกลสุดแค่ 'monitoring' และการประเมินคงเหลือพาไปได้แค่ 'accepted'
 * เส้นนี้จึงเป็นทางเดียวที่ปิดรายการได้ ต้องทำมาตรการครบและประเมินคงเหลือก่อน
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReviewRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const registerId = Number(id)

  const [{ data: register }, { data: actions }] = await Promise.all([
    supabaseAdmin.from('risk_register').select('*').eq('id', registerId).is('deleted_at', null).single(),
    supabaseAdmin.from('risk_actions').select('status').eq('register_id', registerId),
  ])

  if (!register) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })
  if (register.status === 'closed') return NextResponse.json({ error: 'รายการนี้ปิดไปแล้ว' }, { status: 409 })

  const blockers: string[] = []
  const list = actions ?? []
  if (list.some(a => a.status !== 'done')) blockers.push('ยังมีมาตรการที่ทำไม่เสร็จ')
  if (!register.residual_score) blockers.push('ยังไม่ได้ประเมินความเสี่ยงคงเหลือ')

  if (blockers.length > 0) {
    return NextResponse.json({ error: 'ยังปิดรายการไม่ได้', blockers }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('risk_register')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', registerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  auditRisk('register.close', actor.id, data.risk_no ?? id, 'ปิดรายการ')
  return NextResponse.json({ data })
}
