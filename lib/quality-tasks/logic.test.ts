import assert from 'node:assert/strict'
import {
  canViewOccurrence,
  canMutateOccurrence,
  canManageQualityTaskOccurrence,
  completionBlockReason,
  deriveTaskState,
  generatePeriods,
  isWeekendDate,
  isCheckInClosed,
  canManageQualityTaskHolidays,
  nextBusinessDay,
  occurrenceKey,
  occurrenceCalendarRange,
  occurrenceDisplayTitle,
  supportsActionItems,
  resolveAssigneeEntries,
} from './logic'
import type { QualityTaskSchedule } from './types'

function schedule(overrides: Partial<QualityTaskSchedule> = {}): QualityTaskSchedule {
  return {
    id: 'schedule-1', templateId: 'template-1', intervalUnit: 'month', intervalCount: 1,
    recurrenceMode: 'fixed_calendar', startsOn: '2025-10-01', endsOn: null, dueDayOfMonth: null, active: true, ...overrides,
  }
}

assert.deepEqual(
  generatePeriods(schedule(), '2026-01-01', '2026-03-31').map(p => [p.start, p.end]),
  [['2026-01-01', '2026-01-31'], ['2026-02-01', '2026-02-28'], ['2026-03-01', '2026-03-31']],
  'generates one occurrence for every calendar month',
)

assert.deepEqual(
  generatePeriods(schedule({ intervalCount: 6 }), '2025-10-01', '2026-09-30').map(p => [p.start, p.end]),
  [['2025-10-01', '2026-03-31'], ['2026-04-01', '2026-09-30']],
  'generates two fiscal half-year periods',
)

assert.deepEqual(
  generatePeriods(schedule({ intervalUnit: 'year' }), '2025-10-01', '2026-09-30').map(p => [p.start, p.end]),
  [['2025-10-01', '2026-09-30']],
  'generates an October-to-September fiscal-year period',
)

assert.deepEqual(
  deriveTaskState({ status: 'open', plannedDate: null, periodEnd: '2026-07-31', reminderDays: 7 }, '2026-07-24'),
  { scheduling: 'unscheduled', urgency: 'due-soon', effectiveDueDate: '2026-07-31' },
)
assert.deepEqual(
  deriveTaskState({ status: 'open', plannedDate: null, periodStart: '2026-08-01', periodEnd: '2026-08-31', dueDayOfMonth: 15, reminderDays: 7 }, '2026-08-10'),
  { scheduling: 'unscheduled', urgency: 'due-soon', effectiveDueDate: '2026-08-17' },
  '15th falls on a Saturday in Aug 2026, so the auto due date shifts to the next business day (Monday 17th)',
)
assert.deepEqual(
  deriveTaskState({ status: 'open', plannedDate: null, periodStart: '2026-08-01', periodEnd: '2026-08-31', dueDayOfMonth: 15, reminderDays: 7 }, '2026-08-10', new Set(['2026-08-17'])),
  { scheduling: 'unscheduled', urgency: 'normal', effectiveDueDate: '2026-08-18' },
  'also skips past a configured holiday that falls on the first business day after the weekend',
)
assert.equal(nextBusinessDay('2026-08-15'), '2026-08-17', 'Saturday shifts forward to the following Monday')
assert.equal(nextBusinessDay('2026-08-10'), '2026-08-10', 'a weekday with no holiday is left unchanged')
assert.equal(nextBusinessDay('2026-08-10', new Set(['2026-08-10'])), '2026-08-11', 'a holiday weekday shifts to the next day')
assert.deepEqual(
  deriveTaskState({ status: 'open', plannedDate: '2026-08-02', periodEnd: '2026-07-31', reminderDays: 7 }, '2026-08-03'),
  { scheduling: 'scheduled', urgency: 'overdue', effectiveDueDate: '2026-08-02' },
  'allows a planned date outside the period and uses it as the deadline',
)
assert.equal(
  deriveTaskState({ status: 'completed', plannedDate: '2026-01-01', periodEnd: '2026-01-31', reminderDays: 7 }, '2026-08-03').urgency,
  'completed',
)

assert.deepEqual(
  resolveAssigneeEntries([{ userId: 'default-a', manualName: null }, { userId: 'default-b', manualName: null }], []),
  [{ userId: 'default-a', manualName: null }, { userId: 'default-b', manualName: null }],
)
assert.deepEqual(
  resolveAssigneeEntries([{ userId: 'default-a', manualName: null }], [{ userId: null, manualName: 'Manual Name' }]),
  [{ userId: null, manualName: 'Manual Name' }],
  'a non-empty override (even a manual-only entry) replaces the default wholesale',
)
assert.equal(canMutateOccurrence('edit', false, false), true, 'edit permission can manage unassigned work')
assert.equal(canMutateOccurrence('view', true, false), true, 'assigned viewer can perform work')
assert.equal(canMutateOccurrence('view', false, false), false)
assert.equal(canMutateOccurrence('none', true, false), false)
assert.equal(canManageQualityTaskOccurrence('view', true, false), true, 'creator with view permission can manage the occurrence')
assert.equal(canManageQualityTaskOccurrence('view', false, true), true, 'current responsible viewer can manage the occurrence')
assert.equal(canManageQualityTaskOccurrence('edit', false, false), false, 'module edit permission alone cannot take over another occurrence')
assert.equal(canManageQualityTaskOccurrence('view', false, false), false, 'unrelated calendar viewer cannot mutate the occurrence')
assert.equal(canManageQualityTaskOccurrence('edit', false, false, true), true, 'Admin can manage every occurrence')
assert.equal(canViewOccurrence('edit'), true, 'edit permission can view every occurrence')
assert.equal(canViewOccurrence('view'), true, 'view permission can view every occurrence')
assert.equal(canViewOccurrence('none'), false)
assert.equal(supportsActionItems({ taskKind: 'meeting', participantCount: 0, checkInCount: 0 }), true)
assert.equal(supportsActionItems({ taskKind: 'activity', participantCount: 1, checkInCount: 0 }), true, 'activity with meeting participants supports action items')
assert.equal(supportsActionItems({ taskKind: 'activity', participantCount: 0, checkInCount: 1 }), true, 'checked-in activity supports action items')
assert.equal(supportsActionItems({ taskKind: 'activity', participantCount: 0, checkInCount: 0 }), false)
assert.equal(isCheckInClosed('open', null), false)
assert.equal(isCheckInClosed('open', '2026-08-09T00:00:00.000Z'), true, 'manual close blocks an open occurrence')
assert.equal(isCheckInClosed('completed', null), true, 'completed occurrence remains closed')
assert.equal(isWeekendDate('2026-08-08'), true, 'Saturday is highlighted as a weekend')
assert.equal(isWeekendDate('2026-08-09'), true, 'Sunday is highlighted as a weekend')
assert.equal(isWeekendDate('2026-08-10'), false, 'Monday is not highlighted as a weekend')
assert.equal(canManageQualityTaskHolidays('Admin'), true)
assert.equal(canManageQualityTaskHolidays('admin'), true, 'legacy admin role is normalized')
assert.equal(canManageQualityTaskHolidays('Manager'), false, 'holiday management is admin-only')
assert.equal(completionBlockReason(true, 0), 'ต้องแนบ PDF หลักฐานก่อนปิดงาน')
assert.equal(completionBlockReason(true, 1), null)
assert.equal(completionBlockReason(false, 0), null)

assert.equal(
  occurrenceKey(null, 'template-1', '2026-08-19', 'instance-1'),
  'template-1:adhoc:instance-1',
  'ad-hoc occurrence keys use the instance id',
)
assert.notEqual(
  occurrenceKey(null, 'template-1', '2026-08-19', 'instance-1'),
  occurrenceKey(null, 'template-1', '2026-08-19', 'instance-2'),
  'two ad-hoc instances on the same date must have different keys',
)
assert.equal(
  occurrenceKey('schedule-1', 'template-1', '2026-08-19', 'instance-1'),
  'schedule-1:2026-08-19',
  'scheduled occurrence keys remain schedule-based',
)

assert.deepEqual(
  occurrenceCalendarRange({ scheduleId: null, periodStart: '2026-08-20', periodEnd: '2026-08-20', plannedDate: '2026-08-31' }),
  { start: '2026-08-31', end: '2026-08-31' },
  'a moved single-day ad-hoc meeting remains visible on its new date',
)
assert.deepEqual(
  occurrenceCalendarRange({ scheduleId: null, periodStart: '2026-08-20', periodEnd: '2026-08-22', plannedDate: null }),
  { start: '2026-08-20', end: '2026-08-22' },
  'multi-day ad-hoc occurrences retain their original range',
)
assert.equal(
  occurrenceDisplayTitle({
    scheduleId: null,
    periodLabel: 'ประชุมทบทวนผลการดำเนินงาน',
    template: { title: 'อื่นๆ/ประชุมทั่วไป', categoryName: 'การประชุมและการสื่อสารภายใน' },
  }),
  'ประชุมทบทวนผลการดำเนินงาน',
  'ad-hoc meeting titles use the subject entered for that occurrence',
)
assert.equal(
  occurrenceDisplayTitle({
    scheduleId: 'schedule-1',
    periodLabel: 'กันยายน 2569',
    template: { title: 'การประชุมคณะกรรมการ', categoryName: 'การประชุมและการสื่อสารภายใน' },
  }),
  'การประชุมคณะกรรมการ',
  'scheduled meeting titles continue to use the template title',
)

console.log('lib/quality-tasks/logic.test.ts: all assertions passed')
