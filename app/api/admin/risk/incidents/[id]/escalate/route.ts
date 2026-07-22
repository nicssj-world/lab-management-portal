import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditRisk, canReviewRisk, getRiskActor } from '@/lib/risk/access'
import { todayBangkok } from '@/lib/risk/register'

/**
 * ยกระดับอุบัติการณ์เป็นรายการในทะเบียนความเสี่ยง
 *
 * นี่คือสะพานระหว่าง ISO 15189 8.7 (จัดการสิ่งที่เกิดแล้ว) กับ 8.5 (จัดการความเสี่ยงเชิงรุก)
 * ใช้เมื่อการทบทวนพบว่าเหตุการณ์นี้สะท้อนความเสี่ยงเชิงระบบที่จะเกิดซ้ำได้
 *
 * รายการทะเบียนที่สร้างขึ้นจะยังไม่มีคะแนน L×S — ผู้ประเมินต้องไปให้คะแนนในทะเบียนเอง
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReviewRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const incidentId = Number(id)

  const { data: incident } = await supabaseAdmin
    .from('incident_reports')
    .select('*')
    .eq('id', incidentId)
    .is('deleted_at', null)
    .single()

  if (!incident) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })
  if (incident.escalated_register_id) {
    return NextResponse.json({ error: 'เรื่องนี้ถูกยกระดับเข้าทะเบียนไปแล้ว' }, { status: 409 })
  }

  const { data: registerRow, error: registerError } = await supabaseAdmin
    .from('risk_register')
    .insert({
      assessed_date: todayBangkok(),
      department: incident.department_found,
      process_step: incident.event_category,
      risk_statement: `จากอุบัติการณ์ ${incident.report_no ?? incidentId}: ${incident.event_detail}`,
      causes: incident.root_cause,
      existing_controls: incident.immediate_correction,
      affected_parties: incident.impact_summary,
      status: 'open',
      created_by: actor.id,
    })
    .select('id, risk_no')
    .single()

  if (registerError) return NextResponse.json({ error: registerError.message }, { status: 500 })

  const { error: linkError } = await supabaseAdmin
    .from('incident_reports')
    .update({ escalated_register_id: registerRow.id, updated_at: new Date().toISOString() })
    .eq('id', incidentId)

  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 })

  auditRisk('incident.escalate', actor.id, incident.report_no ?? id, `สร้างรายการทะเบียน #${registerRow.id}`)
  return NextResponse.json({ data: registerRow }, { status: 201 })
}
