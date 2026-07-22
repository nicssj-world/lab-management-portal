import { supabaseAdmin } from '@/lib/supabase/admin'

export type IncidentStatus = 'reported' | 'reviewing' | 'action' | 'monitoring' | 'closed'

/**
 * ปรับสถานะเรื่องตามความคืบหน้าของมาตรการแก้ไข
 *
 * แก้จุดบกพร่องสองข้อของระบบเดิม:
 *  1. เดิมเมื่อปิดมาตรการครบแต่ไม่มีมาตรการชนิด follow_up สถานะจะค้างที่ "กำลังแก้ไข" ตลอดไป
 *  2. เดิมเขียนทับสถานะ closed เสมอ ทำให้แก้มาตรการของเรื่องที่ปิดแล้ว = เปิดเรื่องใหม่เงียบ ๆ
 */
export async function syncIncidentStatus(incidentId: number) {
  const { data: incident } = await supabaseAdmin
    .from('incident_reports')
    .select('status')
    .eq('id', incidentId)
    .single()

  // เรื่องที่ปิดแล้วเป็นบันทึกที่นิ่งแล้ว การแก้มาตรการย้อนหลังต้องไม่ปลุกให้กลับมาเปิด
  if (!incident || incident.status === 'closed') return

  const { data: actions } = await supabaseAdmin
    .from('risk_actions')
    .select('status')
    .eq('incident_id', incidentId)

  if (!actions || actions.length === 0) return

  const hasOpen = actions.some(a => a.status !== 'done')
  await supabaseAdmin
    .from('incident_reports')
    .update({ status: hasOpen ? 'action' : 'monitoring', updated_at: new Date().toISOString() })
    .eq('id', incidentId)
}

/** เลขที่เรื่องอัตโนมัติ รูปแบบ IOR-<ปีงบ พ.ศ.>-<ลำดับ 4 หลัก> */
export async function nextReportNo(eventDate: string) {
  const [year, month] = eventDate.split('-').map(Number)
  const fiscalYear = month >= 10 ? year + 544 : year + 543
  const prefix = `IOR-${fiscalYear}-`

  const { data } = await supabaseAdmin
    .from('incident_reports')
    .select('report_no')
    .like('report_no', `${prefix}%`)
    .order('report_no', { ascending: false })
    .limit(1)

  const last = Number(data?.[0]?.report_no?.slice(prefix.length)) || 0
  return `${prefix}${String(last + 1).padStart(4, '0')}`
}
