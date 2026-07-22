import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditRisk, canEditRisk, getRiskActor } from '@/lib/risk/access'
import { nextReportNo } from '@/lib/risk/incident'
import { incidentReportSchema } from '@/lib/validations/incident'

/**
 * รายงานอุบัติการณ์โดยเจ้าหน้าที่ทุกคน
 *
 * ตรวจแค่ว่าล็อกอินอยู่ ไม่ตรวจ permission matrix โดยตั้งใจ — การกั้นไม่ให้คนที่เห็นเหตุการณ์
 * รายงานเข้ามาคือสาเหตุที่ระบบรายงานอุบัติการณ์ล้มเหลว
 *
 * สิ่งที่ตัดสินคุณภาพ (ระดับความรุนแรง สถานะ การวิเคราะห์) ผู้ทบทวนเป็นคนใส่ทีหลัง
 * schema นี้จึงไม่มีฟิลด์เหล่านั้นเลย ส่งมาก็ถูก zod ตัดทิ้ง
 */
export async function POST(req: NextRequest) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = incidentReportSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({
      error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง',
      field: parsed.error.issues[0]?.path?.[0],
    }, { status: 422 })
  }

  // บันทึกแทนผู้อื่น (โทรมาแจ้ง / ส่งใบกระดาษ) ทำได้เฉพาะผู้มีสิทธิ์แก้ไขทะเบียน
  // reported_by = คนที่กดส่ง ปลอมไม่ได้ · reporter_name = คนที่พบเหตุการณ์จริง
  const onBehalfName = parsed.data.reporter_name?.trim()
  const canRecordOnBehalf = onBehalfName ? await canEditRisk(actor) : false

  const { data, error } = await supabaseAdmin
    .from('incident_reports')
    .insert({
      ...parsed.data,
      report_no: await nextReportNo(parsed.data.event_date),
      status: 'reported',
      reported_by: actor.id,
      reporter_name: canRecordOnBehalf ? onBehalfName : actor.name,
      created_by: actor.id,
    })
    .select('id, report_no')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  auditRisk('incident.report', actor.id, data.report_no ?? String(data.id), parsed.data.event_detail.slice(0, 120))
  return NextResponse.json({ data }, { status: 201 })
}
