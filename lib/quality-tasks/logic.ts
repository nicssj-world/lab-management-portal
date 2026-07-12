import type { PermLevel } from '@/lib/permissions'
import type { QualityTaskSchedule, TaskSchedulingState, TaskStatus, TaskUrgency } from './types'

const DAY_MS = 86_400_000

function parseIso(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10)
}

function advance(date: Date, unit: QualityTaskSchedule['intervalUnit'], count: number) {
  const next = new Date(date)
  if (unit === 'week') next.setUTCDate(next.getUTCDate() + count * 7)
  if (unit === 'month') next.setUTCMonth(next.getUTCMonth() + count)
  if (unit === 'year') next.setUTCFullYear(next.getUTCFullYear() + count)
  return next
}

export function generatePeriods(schedule: QualityTaskSchedule, rangeStart: string, rangeEnd: string) {
  if (!schedule.active || schedule.intervalCount < 1) return []
  const from = parseIso(rangeStart)
  const to = parseIso(rangeEnd)
  const scheduleEnd = schedule.endsOn ? parseIso(schedule.endsOn) : null
  const result: { start: string; end: string }[] = []
  let start = parseIso(schedule.startsOn)

  while (start <= to && (!scheduleEnd || start <= scheduleEnd)) {
    const next = advance(start, schedule.intervalUnit, schedule.intervalCount)
    const end = new Date(next.getTime() - DAY_MS)
    if (end >= from) result.push({ start: iso(start), end: iso(scheduleEnd && end > scheduleEnd ? scheduleEnd : end) })
    start = next
  }
  return result
}

export function deriveTaskState(
  input: { status: TaskStatus; plannedDate: string | null; periodEnd: string; reminderDays: number },
  today: string,
): { scheduling: TaskSchedulingState; urgency: TaskUrgency; effectiveDueDate: string } {
  const effectiveDueDate = input.plannedDate ?? input.periodEnd
  const scheduling = input.plannedDate ? 'scheduled' : 'unscheduled'
  if (input.status === 'completed') return { scheduling, urgency: 'completed', effectiveDueDate }
  const remaining = Math.round((parseIso(effectiveDueDate).getTime() - parseIso(today).getTime()) / DAY_MS)
  const urgency: TaskUrgency = remaining < 0 ? 'overdue' : remaining <= input.reminderDays ? 'due-soon' : 'normal'
  return { scheduling, urgency, effectiveDueDate }
}

export function resolveAssigneeIds(defaultIds: string[], overrideIds: string[]) {
  return overrideIds.length ? [...new Set(overrideIds)] : [...new Set(defaultIds)]
}

export function canMutateOccurrence(level: PermLevel, isAssigned: boolean, _isUnassigned: boolean) {
  return level === 'edit' || (level === 'view' && isAssigned)
}

export function completionBlockReason(evidenceRequired: boolean, attachmentCount: number) {
  return evidenceRequired && attachmentCount < 1 ? 'ต้องแนบ PDF หลักฐานก่อนปิดงาน' : null
}

export function bangkokToday(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function occurrenceKey(scheduleId: string | null, templateId: string, periodStart: string) {
  return scheduleId ? `${scheduleId}:${periodStart}` : `${templateId}:adhoc:${periodStart}`
}
