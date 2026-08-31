import type { PermLevel } from '@/lib/permissions'
import { isAdminRole } from '@/lib/roles'
import type { AssigneeEntry, QualityTaskSchedule, TaskKind, TaskSchedulingState, TaskStatus, TaskUrgency } from './types'

const DAY_MS = 86_400_000

// The lab started actually using this system in 2569-07 (Jul 2026). Schedules carry
// startsOn dates from earlier fiscal years (for correct period math), but periods
// ending before go-live were never worked in the system and must not haunt the
// reminder queue forever just because nobody closed them.
export const QUALITY_TASK_TRACKING_START = '2026-07-01'

function parseIso(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10)
}

function advance(date: Date, unit: QualityTaskSchedule['intervalUnit'], count: number) {
  const next = new Date(date)
  if (unit === 'day') next.setUTCDate(next.getUTCDate() + count)
  if (unit === 'week') next.setUTCDate(next.getUTCDate() + count * 7)
  if (unit === 'month' || unit === 'year') {
    const originalDay = next.getUTCDate()
    const targetMonth = next.getUTCMonth() + (unit === 'month' ? count : count * 12)
    next.setUTCDate(1)
    next.setUTCMonth(targetMonth)
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
    next.setUTCDate(Math.min(originalDay, lastDay))
  }
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

// Auto-computed due dates (fixed day-of-month, or period end when there's no such day) must
// never land on a weekend or a configured holiday — push forward to the next business day.
// A user-picked plannedDate is exempt: it is validated at the point of choice (updateOccurrence)
// and shifting it here would silently override what the person explicitly selected.
export function nextBusinessDay(date: string, holidays: ReadonlySet<string> = new Set()) {
  let current = date
  while (isWeekendDate(current) || holidays.has(current)) {
    current = iso(new Date(parseIso(current).getTime() + DAY_MS))
  }
  return current
}

export function deriveTaskState(
  input: { status: TaskStatus; plannedDate: string | null; periodStart?: string; periodEnd: string; dueDayOfMonth?: number | null; reminderDays: number },
  today: string,
  holidays: ReadonlySet<string> = new Set(),
): { scheduling: TaskSchedulingState; urgency: TaskUrgency; effectiveDueDate: string } {
  const monthDueDate = input.periodStart && input.dueDayOfMonth
    ? `${input.periodStart.slice(0, 7)}-${String(input.dueDayOfMonth).padStart(2, '0')}`
    : null
  const effectiveDueDate = input.plannedDate ?? nextBusinessDay(monthDueDate ?? input.periodEnd, holidays)
  const scheduling = input.plannedDate ? 'scheduled' : 'unscheduled'
  if (input.status === 'completed') return { scheduling, urgency: 'completed', effectiveDueDate }
  const remaining = Math.round((parseIso(effectiveDueDate).getTime() - parseIso(today).getTime()) / DAY_MS)
  const urgency: TaskUrgency = remaining < 0 ? 'overdue' : remaining <= input.reminderDays ? 'due-soon' : 'normal'
  return { scheduling, urgency, effectiveDueDate }
}

// Same "non-empty override replaces the default wholesale" rule the old resolveAssigneeIds
// used, generalized to entries that may be a linked user or a manually-typed name.
export function resolveAssigneeEntries(defaultEntries: AssigneeEntry[], overrideEntries: AssigneeEntry[]) {
  return overrideEntries.length ? overrideEntries : defaultEntries
}

export function canMutateOccurrence(level: PermLevel, isAssigned: boolean, _isUnassigned: boolean) {
  return level === 'edit' || (level === 'view' && isAssigned)
}

export function canViewOccurrence(level: PermLevel) {
  return level === 'view' || level === 'edit'
}

export function isCheckInClosed(status: TaskStatus, closedAt: string | null) {
  return status === 'completed' || Boolean(closedAt)
}

export function isWeekendDate(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 || day === 6
}

export function canManageQualityTaskHolidays(role: string | null | undefined) {
  return isAdminRole(role)
}

export function supportsActionItems(input: { taskKind: TaskKind; participantCount: number; checkInCount: number }) {
  return input.taskKind === 'meeting' || input.participantCount > 0 || input.checkInCount > 0
}

export function completionBlockReason(evidenceRequired: boolean, attachmentCount: number) {
  return evidenceRequired && attachmentCount < 1 ? 'ต้องแนบ PDF หลักฐานก่อนปิดงาน' : null
}

export function bangkokToday(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function occurrenceKey(scheduleId: string | null, templateId: string, periodStart: string, instanceId: string | null = null) {
  return scheduleId ? `${scheduleId}:${periodStart}` : `${templateId}:adhoc:${instanceId ?? periodStart}`
}

// The visible calendar date is plannedDate. A moved single-day ad-hoc
// occurrence still has its original periodEnd, which must not create an
// inverted range after the move.
export function occurrenceCalendarRange(input: {
  scheduleId: string | null
  periodStart: string
  periodEnd: string
  plannedDate: string | null
}) {
  const start = input.plannedDate ?? input.periodStart
  const isMultiDayAdHoc = input.scheduleId === null && input.periodEnd > input.periodStart
  const end = isMultiDayAdHoc && input.periodEnd >= start ? input.periodEnd : start
  return { start, end }
}

// Ad-hoc occurrences (scheduleId === null) store their user-typed subject in periodLabel —
// there is no separate title column. Scheduled occurrences always use the template's title.
export function occurrenceDisplayTitle(o: { scheduleId: string | null; periodLabel: string; template: { title: string; categoryName: string } }): string {
  const adHocTitle = o.scheduleId === null ? o.periodLabel.trim() : ''
  return adHocTitle || o.template.title.trim() || o.template.categoryName.trim()
}

// Same override pattern as occurrenceDisplayTitle: an ad-hoc occurrence made from a generic
// template (e.g. "อื่นๆ/ประชุมทั่วไป") may belong to a team the template's fixed ownerText
// doesn't name (e.g. งานโลหิตวิทยา). ownerTextOverride, when set, replaces it for that occurrence only.
export function occurrenceDisplayOwner(o: { ownerTextOverride: string | null; template: { ownerText: string } }): string {
  return o.ownerTextOverride?.trim() || o.template.ownerText
}
