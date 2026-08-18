import assert from 'node:assert/strict'
import { validateKpiSatisfactionPayload } from './satisfaction-validation'

const valid = validateKpiSatisfactionPayload({
  metric_code: 'donor',
  metric_name: 'ผู้บริจาค',
  fiscal_year: 2569,
  value: 0,
  target_val: 80,
})
assert.equal(valid.ok, true)

const invalidValue = validateKpiSatisfactionPayload({
  metric_code: 'donor',
  metric_name: 'ผู้บริจาค',
  fiscal_year: 2569,
  value: 101,
})
assert.equal(invalidValue.ok, false)

const invalidYear = validateKpiSatisfactionPayload({
  metric_code: 'donor',
  metric_name: 'ผู้บริจาค',
  fiscal_year: 1,
  value: null,
})
assert.equal(invalidYear.ok, false)

console.log('KPI satisfaction validation tests passed')
