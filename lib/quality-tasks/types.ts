export type TaskIntervalUnit = 'week' | 'month' | 'year'
export type TaskStatus = 'open' | 'completed'
export type TaskUrgency = 'normal' | 'due-soon' | 'overdue' | 'completed'
export type TaskSchedulingState = 'unscheduled' | 'scheduled'
export type TaskKind = 'activity' | 'meeting'

export interface QualityTaskSchedule {
  id: string
  templateId: string
  intervalUnit: TaskIntervalUnit
  intervalCount: number
  startsOn: string
  endsOn: string | null
  active: boolean
}

export interface QualityTaskTemplate {
  id: string
  sourceKey: string | null
  categoryCode: string
  categoryName: string
  activityNo: number | null
  title: string
  description: string | null
  referenceCode: string | null
  frequencyText: string
  ownerText: string
  taskKind: TaskKind
  reminderDays: number
  evidenceRequired: boolean
  active: boolean
  defaultAssigneeIds: string[]
  schedules: QualityTaskSchedule[]
}

export interface QualityTaskAttachment {
  id: string
  instanceId: string
  fileName: string
  contentType: string
  sizeBytes: number
  uploadedBy: string
  uploadedAt: string
}

export interface QualityTaskOccurrence {
  key: string
  instanceId: string | null
  template: QualityTaskTemplate
  scheduleId: string | null
  periodStart: string
  periodEnd: string
  periodLabel: string
  plannedDate: string | null
  status: TaskStatus
  note: string | null
  completionNote: string | null
  completedBy: string | null
  completedAt: string | null
  assigneeIds: string[]
  attachments: QualityTaskAttachment[]
  scheduling: TaskSchedulingState
  urgency: TaskUrgency
  effectiveDueDate: string
}

export type OccurrenceCreatePayload =
  | { mode: 'scheduled'; scheduleId: string; periodStart: string }
  | { mode: 'adHoc'; templateId: string; label: string; dueDate: string; assigneeIds: string[] }

export type OccurrenceActionPayload =
  | { action: 'schedule'; plannedDate: string | null; note?: string | null; assigneeIds?: string[] }
  | { action: 'complete'; completionNote?: string | null }
  | { action: 'reopen'; reason: string }

