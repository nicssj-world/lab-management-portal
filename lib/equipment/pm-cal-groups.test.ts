import assert from 'node:assert/strict'
import { buildPlanGroupDrafts, calculateGroupPlannedAmount, LEGACY_CALIBRATION_TEMPLATE } from './pm-cal-groups'
import { pmCalPlanGroupReplaceSchema } from './pm-cal-validation'

assert.equal(calculateGroupPlannedAmount('per_unit', 1500, 3), 4500)
assert.equal(calculateGroupPlannedAmount('lump_sum', 1500, 3), 1500)

const legacy = buildPlanGroupDrafts('legacy_template', 2570)
assert.equal(legacy.length, LEGACY_CALIBRATION_TEMPLATE.length)
assert.ok(legacy.every(row => row.fiscal_year === 2570 && row.status === 'draft'))
assert.ok(legacy.every(row => row.equipment_ids.length === 0 && row.actual_amount === null))

const copied = buildPlanGroupDrafts('fiscal_year', 2570, [{
  id: '11111111-1111-4111-8111-111111111111', fiscal_year: 2569,
  group_name: '1. ตู้ปลอดเชื้อ', plan_name: 'BSC', cal_type: 'CAL', calendar_month: 7,
  due_date: '2026-07-31', provider: 'Vendor', price_mode: 'lump_sum', unit_price: null,
  planned_amount: 30000, actual_amount: 29000, record_status: 'active', version: 2,
}])
assert.equal(copied[0].fiscal_year, 2570)
assert.equal(copied[0].actual_amount, null)
assert.deepEqual(copied[0].equipment_ids, [])
assert.equal(copied[0].due_date, '2027-07-31')

const validGroup = {
  fiscal_year: 2570, group_name: 'BSC', plan_name: 'Biosafety Cabinet', cal_type: 'CAL',
  calendar_month: 7, due_date: '2027-07-31', provider: null, price_mode: 'per_unit',
  unit_price: 1500, planned_amount: 3000, actual_amount: null,
  equipment_ids: ['11111111-1111-4111-8111-111111111111'], version: null,
}
assert.equal(pmCalPlanGroupReplaceSchema.safeParse(validGroup).success, true)
assert.equal(pmCalPlanGroupReplaceSchema.safeParse({ ...validGroup, unit_price: null }).success, false)
assert.equal(pmCalPlanGroupReplaceSchema.safeParse({ ...validGroup, due_date: '2026-07-31' }).success, false)

console.log('pm-cal groups: all cases passed')
