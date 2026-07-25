import type {
  ActivityType, Appointment, BadgeState, OrgType, SafetyAck, VisitType,
} from './constants'

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
}

export type VisitorValidationResult =
  | { ok: true; row: NormalizedVisitorLog }
  | { ok: false; issues: VisitorValidationIssue[] }

export interface PublicVisitorFormState {
  available: boolean
  reason?: 'closed'
}

export interface ActiveVisitorDTO {
  enteredAt: string
  contactDept: string
  destinationCode: string | null
  checkpointCode: string | null
  directionsTh: readonly string[]
}

export interface VisitorCheckInResult {
  logId: string
  checkoutSecret: string
  activeVisit: ActiveVisitorDTO
}
