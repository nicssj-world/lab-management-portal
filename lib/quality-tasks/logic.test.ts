import assert from 'node:assert/strict'
import {
  canViewOccurrence,
  canMutateOccurrence,
  completionBlockReason,
  deriveTaskState,
  generatePeriods,
  isWeekendDate,
  isCheckInClosed,
  canManageQualityTaskHolidays,
  supportsActionItems,
  resolveAssigneeEntries,
} from './logic'
import type { QualityTaskSchedule } from './types'

function schedule(overrides: Partial<QualityTaskSchedule> = {}): QualityTaskSchedule {
  return {
    id: 'schedule-1', templateId: 'template-1', intervalUnit: 'month', intervalCount: 1,
    startsOn: '2025-10-01', endsOn: null, active: true, ...overrides,
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

console.log('lib/quality-tasks/logic.test.ts: all assertions passed')
