import type {
  ActivityType, Appointment, BadgeState, OrgType, SafetyAck, VisitType,
} from './constants'
import type { VisitorFormConfig } from './form-config'

/** สิ่งที่ฟอร์มสาธารณะส่งมา — ยังไม่ผ่านการตรวจ semantic */
export interface VisitorSubmissionInput {
  visit_type: VisitType
  visit_date: string
  visitor_name: string
  group_name?: string | null
  member_names?: string | null
  /** รายบุคคล = จำนวนผู้ติดตาม (≥0) · หมู่คณะ = จำนวนผู้มาทั้งหมด (≥1) */
  head_count: number
  phone: string
  email?: string | null
  org_type: OrgType
  org_name: string
  contact_dept: string
  entered_at: string
  activity_type: ActivityType
  activity_other?: string | null
  appointment: Appointment
  badge_exchanged: BadgeState
  safety_ack: SafetyAck
  safety_ack_other?: string | null
}

export interface VisitorValidationIssue {
  field: keyof VisitorSubmissionInput
  message: string
}

/** แถวที่พร้อมเขียนลง it_visitor_logs — head_count ถูกแปลงเป็น party_size แล้ว */
export interface NormalizedVisitorLog {
  visit_type: VisitType
  visit_date: string
  visitor_name: string
  group_name: string | null
  member_names: string | null
  party_size: number
  phone: string
  email: string | null
  org_type: OrgType
  org_name: string
  contact_dept: string
  entered_at: string
  activity_type: ActivityType
  activity_other: string | null
  appointment: Appointment
  badge_exchanged: BadgeState
  safety_ack: SafetyAck
  safety_ack_other: string | null
}

export type VisitorValidationResult =
  | { ok: true; row: NormalizedVisitorLog }
  | { ok: false; issues: VisitorValidationIssue[] }

export interface PublicVisitorFormState {
  available: boolean
  reason?: 'closed'
  formConfig: VisitorFormConfig
}

export interface ActiveVisitorDTO {
  enteredAt: string
  contactDept: string
  /** จุดสแกนนิ้วมือปลายทาง — null เมื่อหน่วยงานไม่มีการจับคู่ที่อนุมัติไว้ (fail closed) */
  checkpointCode: string | null
  checkpointNameTh: string | null
  routeCode: string | null
  directionsTh: readonly string[]
  /** สถานีความปลอดภัยที่ตรงกับจุดสแกนนี้ — ใช้เป็นจุดเริ่มต้นของแผนหนีไฟให้ตรงตำแหน่งจริงที่ยืนอยู่ */
  safetyStationCode: string
}

export interface VisitorCheckInResult {
  logId: string
  checkoutSecret: string
  activeVisit: ActiveVisitorDTO
}
