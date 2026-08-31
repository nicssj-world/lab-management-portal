export type TaskWorkstream = 'quality' | 'safety'
export type TaskIntervalUnit = 'day' | 'week' | 'month' | 'year'
export type RecurrenceMode = 'fixed_calendar' | 'rolling_completion'
export type TaskStatus = 'open' | 'in_progress' | 'pending_review' | 'completed'
export type TaskUrgency = 'normal' | 'due-soon' | 'overdue' | 'completed'
export type TaskSchedulingState = 'unscheduled' | 'scheduled'
export type TaskKind = 'activity' | 'meeting'
export type ApprovalMode = 'none' | 'required'
export type IntegrationKind =
  | 'none'
  | 'safety_inspection'
  | 'equipment_reference'
  | 'evacuation_plan_review'
  | 'evacuation_drill'

// A responsible person can be a linked system user OR a manually-typed name (matching the
// equipment registry's "dropdown or type a name yourself" pattern) — never both meaningfully
// set at once (picking a user auto-fills manualName with that user's name for display).
export interface AssigneeEntry {
  userId: string | null
  manualName: string | null
}

export interface QualityTaskSchedule {
  id: string
  templateId: string
  intervalUnit: TaskIntervalUnit
  intervalCount: number
  recurrenceMode: RecurrenceMode
  dueDayOfMonth?: number | null
  startsOn: string
  endsOn: string | null
  active: boolean
}

export interface QualityTaskTemplate {
  id: string
  sourceKey: string | null
  workstream: TaskWorkstream
  categoryCode: string
  categoryName: string
  activityNo: number | null
  title: string
  description: string | null
  referenceCode: string | null
  frequencyText: string
  ownerText: string
  taskKind: TaskKind
  approvalMode: ApprovalMode
  integrationKind: IntegrationKind
  approverId: string | null
  reminderDays: number
  evidenceRequired: boolean
  active: boolean
  defaultAssignees: AssigneeEntry[]
  defaultParticipantDepts: string[]
  defaultParticipantUserIds: string[]
  evidenceRequirements: QualityTaskEvidenceRequirement[]
  schedules: QualityTaskSchedule[]
}

export interface QualityTaskEvidenceRequirement {
  id: string
  templateId: string
  label: string
  evidenceKind: string
  required: boolean
  minimumFiles: number
  sortOrder: number
}

export interface QualityTaskAttachment {
  id: string
  instanceId: string
  requirementId: string | null
  evidenceKind: string
  fileName: string
  contentType: string
  sizeBytes: number
  uploadedBy: string
  uploadedAt: string
}

export interface QualityTaskCheckIn {
  /** null = เช็คอินโดยผู้ไม่มีบัญชีในระบบ (ดู guestName/guestSurname/guestDepartment แทน) */
  userId: string | null
  checkedInAt: string
  method: 'qr' | 'manual' | 'guest'
  /** true = ตอนเช็คอินคนนี้ยังไม่อยู่ในรายชื่อผู้เข้าร่วม ระบบเพิ่มให้อัตโนมัติ */
  wasUnlisted: boolean
  guestName: string | null
  guestSurname: string | null
  guestDepartment: string | null
}

export type QualityTaskHolidayKind = 'public' | 'special'
export type QualityTaskHolidaySource = 'manual' | 'google_th_holidays'

export interface QualityTaskHoliday {
  id: string
  holidayDate: string
  name: string
  kind: QualityTaskHolidayKind
  source: QualityTaskHolidaySource
}

export interface QualityTaskOccurrence {
  key: string
  instanceId: string | null
  template: QualityTaskTemplate
  scheduleId: string | null
  periodStart: string
  periodEnd: string
  periodLabel: string
  ownerTextOverride: string | null
  plannedDate: string | null
  plannedStartTime: string | null
  plannedEndTime: string | null
  meetingLocation: string | null
  meetingAgenda: string | null
  status: TaskStatus
  note: string | null
  completionNote: string | null
  completedBy: string | null
  completedAt: string | null
  submittedBy: string | null
  submittedAt: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
  assignees: AssigneeEntry[]
  participantDepts: string[]
  participantUserIds: string[]
  participants: { id: string; name: string; positionTitle: string | null }[]
  attachments: QualityTaskAttachment[]
  checkInToken: string | null
  checkInClosedAt: string | null
  checkIns: QualityTaskCheckIn[]
  scheduling: TaskSchedulingState
  urgency: TaskUrgency
  effectiveDueDate: string
}

export interface QualityTaskActionItem {
  id: string
  instanceId: string
  assignee: AssigneeEntry
  description: string
  dueDate: string | null
  doneAt: string | null
  doneBy: string | null
  sourceType: string | null
  sourceId: string | null
}

export interface SafetyCertificate {
  id: string
  certificateType: string
  documentNo: string | null
  holderName: string
  department: string | null
  issuedOn: string | null
  expiresOn: string | null
  noExpiry: boolean
  ownerId: string | null
  fileName: string
  contentType: string
  sizeBytes: number
  uploadedAt: string
  renewalInstanceId: string | null
}

export type OccurrenceCreatePayload =
  | { mode: 'scheduled'; scheduleId: string; periodStart: string }
  | { mode: 'adHoc'; templateId: string; label: string; ownerText?: string; startDate: string; endDate: string; startTime?: string | null; endTime?: string | null; location?: string | null; agenda?: string | null; participantDepts?: string[]; participantUserIds?: string[]; assignees: AssigneeEntry[] }

export type OccurrenceActionPayload =
  | { action: 'schedule'; plannedDate: string | null; note?: string | null; startTime?: string | null; endTime?: string | null; assignees?: AssigneeEntry[]; participantDepts?: string[]; participantUserIds?: string[] }
  | { action: 'start' }
  | { action: 'submit'; completionNote?: string | null }
  | { action: 'approve'; note?: string | null }
  | { action: 'reject'; reason: string }
  | { action: 'complete'; completionNote?: string | null }
  | { action: 'reopen'; reason: string }

