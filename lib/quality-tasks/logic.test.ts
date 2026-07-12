import assert from 'node:assert/strict'
import {
  canMutateOccurrence,
  completionBlockReason,
  deriveTaskState,
  generatePeriods,
  resolveAssigneeIds,
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

assert.deepEqual(resolveAssigneeIds(['default-a', 'default-b'], []), ['default-a', 'default-b'])
assert.deepEqual(resolveAssigneeIds(['default-a'], ['override-a']), ['override-a'])
assert.equal(canMutateOccurrence('edit', false, false), true, 'edit permission can manage unassigned work')
assert.equal(canMutateOccurrence('view', true, false), true, 'assigned viewer can perform work')
assert.equal(canMutateOccurrence('view', false, false), false)
assert.equal(canMutateOccurrence('none', true, false), false)
assert.equal(completionBlockReason(true, 0), 'ต้องแนบ PDF หลักฐานก่อนปิดงาน')
assert.equal(completionBlockReason(true, 1), null)
assert.equal(completionBlockReason(false, 0), null)

console.log('lib/quality-tasks/logic.test.ts: all assertions passed')
