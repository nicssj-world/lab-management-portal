import assert from 'node:assert/strict'
import { parsePmCalFiscalYear, pmCalPlanReplaceSchema, pmCalResultCreateSchema } from './pm-cal-validation'

assert.equal(parsePmCalFiscalYear('2569', 2570), 2569)
assert.equal(parsePmCalFiscalYear(null, 2570), 2570)
assert.equal(parsePmCalFiscalYear('not-a-year', 2570), null)
assert.equal(parsePmCalFiscalYear('2499', 2570), null)
assert.equal(parsePmCalFiscalYear('3001', 2570), null)

const validPlan = {
  calendar_month: 7,
  cal_type: 'CAL',
  due_date: '2026-07-31',
  provider: 'บริษัททดสอบ',
  planned_cost: 1500,
  version: null,
}

const planPayload = { fiscal_year: 2569, expected_versions: {}, plans: [validPlan] }
assert.equal(pmCalPlanReplaceSchema.safeParse(planPayload).success, true)
assert.equal(pmCalPlanReplaceSchema.safeParse({ ...planPayload, plans: [{ ...validPlan, due_date: '2026-02-31' }] }).success, false)
assert.equal(pmCalPlanReplaceSchema.safeParse({ ...planPayload, plans: [{ ...validPlan, calendar_month: 13 }] }).success, false)
assert.equal(pmCalPlanReplaceSchema.safeParse({ ...planPayload, plans: [validPlan, validPlan] }).success, false)

const validResult = {
  plan_id: '11111111-1111-4111-8111-111111111111',
  cal_type: 'CAL',
  completed_date: '2026-07-20',
  result: 'PASS',
  remark: null,
}

assert.equal(pmCalResultCreateSchema.safeParse(validResult).success, true)
assert.equal(pmCalResultCreateSchema.safeParse({ ...validResult, completed_date: '2026-15-03' }).success, false)
assert.equal(pmCalResultCreateSchema.safeParse({ ...validResult, completed_date: '2099-01-01' }).success, false)
assert.equal(pmCalResultCreateSchema.safeParse({ ...validResult, result: 'NOT_PERFORMED', remark: null }).success, false)
assert.equal(pmCalResultCreateSchema.safeParse({ ...validResult, result: 'NOT_PERFORMED', remark: 'ส่งบริษัทไม่ทัน' }).success, true)
assert.equal(pmCalResultCreateSchema.safeParse({ ...validResult, cal_type: 'PM', result: null }).success, true)
assert.equal(pmCalResultCreateSchema.safeParse({ ...validResult, cal_type: 'PM', result: 'PASS' }).success, false)
assert.equal(pmCalResultCreateSchema.safeParse({ ...validResult, cal_type: 'PM', result: 'FAIL' }).success, false)

console.log('pm-cal validation: all cases passed')
