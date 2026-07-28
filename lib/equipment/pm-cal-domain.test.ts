import assert from 'node:assert/strict'
import {
  compareByFiscalMonth,
  computeEquipmentPmCalState,
  computePmCalPlanState,
  fiscalYearForDate,
  fiscalYearMonthToCalendarYear,
  FISCAL_MONTH_ORDER,
  bangkokIsoDate,
  isStrictIsoDate,
  type PmCalPlanRecord,
  type PmCalResultRecord,
} from './pm-cal-domain'

// Thai fiscal year runs Oct-Sep: October must sort before January within the same fiscal year.
assert.deepEqual(FISCAL_MONTH_ORDER, [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9])
assert.deepEqual([...[5, 10, 1, 12, 9]].sort(compareByFiscalMonth), [10, 12, 1, 5, 9])

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
// A null CAL result only happens on legacy imports (manual entry always sets PASS/FAIL/NOT_PERFORMED)
// and means "was done, pass/fail unknown" — must count as completed, not leave the plan overdue.
assert.equal(computePmCalPlanState(plan(), [result({ result: null })], TODAY), 'completed')
// A later real FAIL must still be able to override a bare legacy null — otherwise recording the
// actual outcome after the fact (via "บันทึกผลเพิ่มเติม") could never flip a legacy-completed plan
// to failed, since the untouched null result would keep winning forever.
assert.equal(computePmCalPlanState(plan(), [result({ result: null }), result({ id: 'result-2', result: 'FAIL' })], TODAY), 'failed')
// PASS still wins over both FAIL and a bare null (a later successful re-cal clears everything else).
assert.equal(computePmCalPlanState(plan(), [result({ result: null }), result({ id: 'result-2', result: 'FAIL' }), result({ id: 'result-3', result: 'PASS' })], TODAY), 'completed')
// Legacy-imported results are unlinked (plan_id null) but still satisfy a plan whose
// fiscal_year/calendar_month/cal_type matches the result's completed_date — see EquipmentPmCalModal
// "ประวัตินำเข้า (ไม่ผูกแผน)" entries, which used to leave the matching plan stuck "overdue" forever.
assert.equal(computePmCalPlanState(plan(), [result({ plan_id: null, completed_date: '2026-07-01' })], TODAY), 'completed')
assert.equal(computePmCalPlanState(plan(), [result({ plan_id: null, result: 'FAIL', completed_date: '2026-07-01' })], TODAY), 'failed')
// Unlinked result in a different month/cal_type must not satisfy an unrelated plan.
assert.equal(computePmCalPlanState(plan(), [result({ plan_id: null, completed_date: '2026-06-30' })], TODAY), 'due_soon')
assert.equal(computePmCalPlanState(plan(), [result({ plan_id: null, cal_type: 'PM', completed_date: '2026-07-01' })], TODAY), 'due_soon')
// Unlinked result belonging to a *different* plan_id (not this plan, not null) must not satisfy this plan.
assert.equal(computePmCalPlanState(plan(), [result({ plan_id: 'plan-2', completed_date: '2026-07-01' })], TODAY), 'due_soon')
// An unlinked result for a DIFFERENT piece of equipment must never satisfy this plan, even if
// month/year/cal_type all match — guards a caller (e.g. an all-equipment report) that forgets to
// pre-scope results by equipment before calling this function.
assert.equal(computePmCalPlanState(plan(), [result({ plan_id: null, equipment_id: 'equipment-2', completed_date: '2026-07-01' })], TODAY), 'due_soon')

assert.equal(computeEquipmentPmCalState(false, [], [], TODAY), 'not_required')
assert.equal(computeEquipmentPmCalState(true, [], [], TODAY), 'unplanned')
assert.equal(computeEquipmentPmCalState(true, [plan()], [], TODAY), 'due_soon')
assert.equal(computeEquipmentPmCalState(true, [plan()], [result({ result: 'FAIL' })], TODAY), 'failed')
assert.equal(computeEquipmentPmCalState(true, [plan()], [result()], TODAY), 'completed')

console.log('pm-cal domain: all cases passed')
