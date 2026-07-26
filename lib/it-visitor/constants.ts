// แหล่งความจริงเดียวของ enum + label ไทยของบันทึกการเข้า-ออก
// ใช้ร่วมกันทั้ง public form, staff table, PDF และ zod schema
// ค่าทุกตัวต้องตรงกับ CHECK constraint ใน scripts/it-visitor-log.sql
// (scripts/it-visitor-log.test.ts ยืนยันให้)

// re-export จาก lab-map/visitor.ts — เป็นเจ้าของค่าจริงเพราะต้องผูกกับจุดสแกน/เส้นทางในผัง
export { GROUP_HEAD_CONTACT_DEPT } from '@/lib/lab-map/visitor'

export const VISIT_TYPES = ['individual', 'group'] as const
export type VisitType = typeof VISIT_TYPES[number]
export const VISIT_TYPE_LABEL: Record<VisitType, string> = {
  individual: 'รายบุคคล',
  group:      'หมู่คณะ',
}

export const ORG_TYPES = ['internal', 'external'] as const
export type OrgType = typeof ORG_TYPES[number]
export const ORG_TYPE_LABEL: Record<OrgType, string> = {
  internal: 'หน่วยงานภายในโรงพยาบาล',
  external: 'หน่วยงานภายนอกโรงพยาบาล',
}

export const ACTIVITY_TYPES = [
  'maintenance', 'sales_visit', 'send_lab',
  'utility_safety', 'audit', 'lab_tour', 'other',
] as const
export type ActivityType = typeof ACTIVITY_TYPES[number]
export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  maintenance:    'ซ่อมบำรุง',
  sales_visit:    'พบลูกค้า นำเสนอข้อมูลสินค้า/visit',
  send_lab:       'ส่ง Lab',
  utility_safety: 'ตรวจสอบระบบสาธารณูปโภค/ความปลอดภัย',
  audit:          'ตรวจประเมิน',
  lab_tour:       'เยี่ยมชมห้องปฏิบัติการ',
  other:          'อื่นๆ',
}

export const APPOINTMENTS = ['booked', 'walk_in'] as const
export type Appointment = typeof APPOINTMENTS[number]
export const APPOINTMENT_LABEL: Record<Appointment, string> = {
  booked:  'นัดหมาย',
  walk_in: 'ไม่ได้นัดหมาย',
}

export const BADGE_STATES = ['yes', 'no'] as const
export type BadgeState = typeof BADGE_STATES[number]
export const BADGE_LABEL: Record<BadgeState, string> = {
  yes: 'แลก',
  no:  'ไม่ได้แลก',
}

export const SAFETY_ACKS = ['acknowledged', 'declined'] as const
export type SafetyAck = typeof SAFETY_ACKS[number]
export const SAFETY_LABEL: Record<SafetyAck, string> = {
  acknowledged: 'ศึกษาและรับทราบข้อมูลความปลอดภัยแล้ว',
  declined:     'ไม่สะดวกและไม่ยินยอมศึกษาข้อมูล',
}

/** ต่อท้าย DEPARTMENTS + GROUP_HEAD_CONTACT_DEPT ใน dropdown "หน่วยงานที่ต้องการติดต่อ" เป็นตัวสุดท้ายเสมอ */
export const CONTACT_DEPT_OTHER = 'อื่นๆ'

export const SAFETY_POLICY_PROMPT =
  'ท่านศึกษานโยบายความปลอดภัยทางห้องปฏิบัติการของกลุ่มงานเทคนิคการแพทย์แล้วหรือไม่'

export const MAX_PARTY_SIZE = 500
