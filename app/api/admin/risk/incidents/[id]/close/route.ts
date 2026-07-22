import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditRisk, canReviewRisk, getRiskActor } from '@/lib/risk/access'

/**
 * ปิดเรื่อง — ตรวจว่ากระบวนการครบตาม ISO 15189 8.7 ก่อน
 *
 * เงื่อนไข residual risk ของระบบเดิมถูกตัดออก เพราะการประเมินความเสี่ยงคงเหลือ
 * ย้ายไปอยู่ที่ทะเบียนความเสี่ยงแล้ว (IOR ที่เป็นความเสี่ยงเชิงระบบให้ยกระดับไปที่นั่น)
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReviewRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const incidentId = Number(id)

  const [{ data: incident }, { data: actions }] = await Promise.all([
    supabaseAdmin.from('incident_reports').select('*').eq('id', incidentId).is('deleted_at', null).single(),
    supabaseAdmin.from('risk_actions').select('*').eq('incident_id', incidentId),
  ])

  if (!incident) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })
  if (incident.status === 'closed') return NextResponse.json({ error: 'เรื่องนี้ปิดไปแล้ว' }, { status: 409 })

  const blockers: string[] = []
  if (!incident.reviewed_at) blockers.push('ยังไม่ได้ทบทวนและกำหนดระดับความรุนแรง')
  if (incident.requires_rca && !incident.root_cause) blockers.push('ระดับความรุนแรงนี้ต้องวิเคราะห์รากของปัญหาก่อน')

  const list = actions ?? []
  if (list.length === 0) blockers.push('ยังไม่มีมาตรการแก้ไข')
  if (list.some(a => a.status !== 'done')) blockers.push('ยังมีมาตรการที่ทำไม่เสร็จ')

  // มาตรการที่ติดตามแล้วพบว่าไม่ได้ผล ต้องมีมาตรการใหม่มารับช่วงก่อนจึงจะปิดเรื่องได้
  const ineffective = list.filter(a => a.is_effective === false)
  if (ineffective.length > 0) {
    const laterActionExists = list.some(a =>
      a.is_effective !== false && a.id > Math.min(...ineffective.map(x => x.id)))
    if (!laterActionExists) blockers.push('มีมาตรการที่ติดตามแล้วไม่ได้ผล ต้องเพิ่มมาตรการใหม่ก่อนปิดเรื่อง')
  }

  if (!incident.effectiveness_result) blockers.push('ยังไม่ได้สรุปผลการติดตามประสิทธิผล')

  if (blockers.length > 0) {
    return NextResponse.json({ error: 'ยังปิดเรื่องไม่ได้', blockers }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('incident_reports')
    .update({
      status: 'closed',
      closed_by: actor.id,
      closed_by_name: actor.name,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', incidentId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  auditRisk('incident.close', actor.id, data.report_no ?? id, 'ปิดเรื่อง')
  return NextResponse.json({ data })
}
