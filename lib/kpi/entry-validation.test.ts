import assert from 'node:assert/strict'
import { validateKpiEntryPayload } from './entry-validation'

const defs = [
  { id: 1, denominator: 'จำนวนทั้งหมด' },
  { id: 2, denominator: null },
]

const incomplete = validateKpiEntryPayload({
  entries: [{ dept_id: 20, kpi_id: 1, fiscal_year: 2569, month: 12, numerator: 1, denominator: null }],
  clear_entries: [],
}, defs)
assert.equal(incomplete.ok, false)
assert.match(incomplete.error, /ตัวหาร/)

const over = validateKpiEntryPayload({
  entries: [{ dept_id: 20, kpi_id: 1, fiscal_year: 2569, month: 12, numerator: 11, denominator: 10 }],
  clear_entries: [],
}, defs)
assert.equal(over.ok, false)
assert.match(over.error, /ตัวตั้ง/)

const unexpectedDenominator = validateKpiEntryPayload({
  entries: [{ dept_id: 20, kpi_id: 2, fiscal_year: 2569, month: 12, numerator: 1, denominator: 10 }],
  clear_entries: [],
}, defs)
assert.equal(unexpectedDenominator.ok, false, 'count KPIs must not accept a denominator')

const valid = validateKpiEntryPayload({
  entries: [{ dept_id: 20, kpi_id: 2, fiscal_year: 2569, month: 12, numerator: 0, denominator: null }],
  clear_entries: [{ dept_id: 20, kpi_id: 1, fiscal_year: 2569, month: 12 }],
}, defs)
assert.equal(valid.ok, true)
if (valid.ok) assert.equal(valid.entries[0].numerator, 0)

const invalidDepartment = validateKpiEntryPayload({
  entries: [{ dept_id: 18, kpi_id: 2, fiscal_year: 2569, month: 12, numerator: 0, denominator: null }],
  clear_entries: [],
}, defs, new Set([20]))
assert.equal(invalidDepartment.ok, false)

const unknownClearKpi = validateKpiEntryPayload({
  entries: [],
  clear_entries: [{ dept_id: 20, kpi_id: 999, fiscal_year: 2569, month: 12 }],
}, defs)
assert.equal(unknownClearKpi.ok, false, 'clearing must not target an unknown KPI definition')

console.log('KPI entry validation tests passed')
