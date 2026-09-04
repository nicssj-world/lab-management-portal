// แยกจาก lib/risk/access.ts เพราะไฟล์นี้เป็นตรรกะล้วน ไม่ต้องพึ่ง Supabase
// จึงเขียนเทสต์ครอบได้โดยตรง (lib/risk/incident.test.ts)

/**
 * ฟิลด์ที่เปลี่ยนได้เฉพาะผู้มีสิทธิ์ทบทวน
 *
 * ทั้งหมดเป็นการตัดสินใจเชิงคุณภาพ ไม่ใช่การบันทึกข้อเท็จจริง — ผู้ที่มีสิทธิ์ "แก้ไข"
 * แก้รายละเอียดเหตุการณ์ได้ แต่ให้ระดับความรุนแรงหรือสรุปรากของปัญหาเองไม่ได้
 */
export const REVIEW_ONLY_FIELDS = [
  'severity_level', 'requires_rca', 'status',
  'review_note', 'reviewed_by', 'reviewed_at',
  'rca_method', 'root_cause', 'rca_factors',
  'effectiveness_result',
  'residual_likelihood', 'residual_impact', 'risk_accepted_by',
] as const

/**
 * ฟิลด์ใน PATCH ของ IOR ที่บุคลากรจัดการได้โดยไม่เปิดสิทธิ์แก้ข้อมูลเหตุการณ์หลัก
 * การกำหนดรายการแบบ allow-list ทำให้ผู้จัดการ workflow เปลี่ยน status หรือข้อมูลผู้ทบทวนเองไม่ได้
 */
export const REVIEW_WORKFLOW_FIELDS = [
  'rca_method', 'root_cause', 'rca_factors', 'effectiveness_result',
] as const

/**
 * ตัดฟิลด์เชิงทบทวนออกเมื่อผู้ใช้ไม่มีสิทธิ์ แล้วคืนคำเตือนกลับไปบอกว่าข้ามอะไรไป
 *
 * ต้องทำฝั่ง server เสมอ การซ่อนปุ่มบนหน้าจอไม่ใช่การบังคับสิทธิ์
 */
export function stripReviewOnlyFields<T extends Record<string, unknown>>(payload: T, allowed: boolean) {
  if (allowed) return { payload, warnings: [] as string[] }

  const cleaned = { ...payload }
  const removed: string[] = []
  for (const field of REVIEW_ONLY_FIELDS) {
    if (field in cleaned) {
      delete cleaned[field]
      removed.push(field)
    }
  }

  return {
    payload: cleaned,
    warnings: removed.length > 0
      ? [`ไม่มีสิทธิ์แก้ไขข้อมูลส่วนการทบทวน จึงข้ามฟิลด์: ${removed.join(', ')}`]
      : [],
  }
}

/** เก็บเฉพาะผล RCA/ติดตามผลสำหรับผู้จัดการ IOR ที่ไม่มีสิทธิ์แก้ข้อมูลเหตุการณ์หลัก */
export function pickReviewWorkflowFields(payload: Record<string, unknown>) {
  const allowed = new Set<string>(REVIEW_WORKFLOW_FIELDS)
  const cleaned: Record<string, unknown> = {}
  const removed: string[] = []

  for (const [field, value] of Object.entries(payload)) {
    if (allowed.has(field)) cleaned[field] = value
    else removed.push(field)
  }

  return {
    payload: cleaned,
    warnings: removed.length > 0
      ? [`ไม่มีสิทธิ์แก้ข้อมูลเหตุการณ์หลัก จึงข้ามฟิลด์: ${removed.join(', ')}`]
      : [],
  }
}
