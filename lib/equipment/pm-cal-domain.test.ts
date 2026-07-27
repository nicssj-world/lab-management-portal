import assert from 'node:assert/strict'
import {
  computeEquipmentPmCalState,
  computePmCalPlanState,
  fiscalYearForDate,
  fiscalYearMonthToCalendarYear,
  bangkokIsoDate,
  isStrictIsoDate,
  type PmCalPlanRecord,
  type PmCalResultRecord,
} from './pm-cal-domain'

const TODAY = new Date(2026, 6, 28)

assert.equal(fiscalYearForDate(new Date(2025, 9, 1)), 2569)
assert.equal(fiscalYearForDate(new Date(2026, 8, 30)), 2569)
assert.equal(fiscalYearForDate(new Date(2026, 9, 1)), 2570)
assert.equal(fiscalYearForDate(new Date('2026-09-30T17:30:00.000Z')), 2570)
assert.equal(fiscalYearMonthToCalendarYear(2569, 10), 2025)
assert.equal(fiscalYearMonthToCalendarYear(2569, 1), 2026)
assert.equal(bangkokIsoDate(new Date('2026-07-27T17:30:00.000Z')), '2026-07-28')

assert.equal(isStrictIsoDate('2026-02-28'), true)
assert.equal(isStrictIsoDate('2026-02-31'), false)
assert.equal(isStrictIsoDate('1980-15-03'), false)

function plan(overrides: Partial<PmCalPlanRecord> = {}): PmCalPlanRecord {
  return {
    id: 'plan-1',
    equipment_id: 'equipment-1',
    fiscal_year: 2569,
    calendar_month: 7,
    cal_type: 'CAL',
    due_date: '2026-07-31',
    record_status: 'active',
    version: 1,
    ...overrides,
  }
}

function result(overrides: Partial<PmCalResultRecord> = {}): PmCalResultRecord {
  return {
    id: 'result-1',
    plan_id: 'plan-1',
    equipment_id: 'equipment-1',
    cal_type: 'CAL',
    completed_date: '2026-07-20',
    result: 'PASS',
    ...overrides,
  }
}

assert.equal(computePmCalPlanState(plan(), [], TODAY), 'due_soon')
assert.equal(computePmCalPlanState(plan({ due_date: '2026-06-30' }), [], TODAY), 'overdue')
assert.equal(computePmCalPlanState(plan({ due_date: '2026-07-27' }), [], new Date('2026-07-27T17:30:00.000Z')), 'overdue')
assert.equal(computePmCalPlanState(plan(), [result()], TODAY), 'completed')
assert.equal(computePmCalPlanState(plan(), [result({ result: 'FAIL' })], TODAY), 'failed')
assert.equal(computePmCalPlanState(plan(), [result({ result: 'FAIL' }), result({ id: 'result-2', result: 'PASS' })], TODAY), 'completed')
assert.equal(computePmCalPlanState(plan({ cal_type: 'PM' }), [result({ cal_type: 'PM', result: null })], TODAY), 'completed')
assert.equal(computePmCalPlanState(plan({ cal_type: 'PM' }), [result({ cal_type: 'PM', result: 'NOT_PERFORMED' })], TODAY), 'due_soon')
assert.equal(computePmCalPlanState(plan(), [result({ result: 'NOT_PERFORMED' })], TODAY), 'due_soon')
assert.equal(computeEquipmentPmCalState(false, [], [], TODAY), 'not_required')
assert.equal(computeEquipmentPmCalState(true, [], [], TODAY), 'unplanned')
assert.equal(computeEquipmentPmCalState(true, [plan()], [], TODAY), 'due_soon')
assert.equal(computeEquipmentPmCalState(true, [plan()], [result({ result: 'FAIL' })], TODAY), 'failed')
assert.equal(computeEquipmentPmCalState(true, [plan()], [result()], TODAY), 'completed')

console.log('pm-cal domain: all cases passed')
