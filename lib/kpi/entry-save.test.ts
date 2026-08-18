import assert from 'node:assert/strict'
import { buildKpiSavePayload } from './entry-save'

const result = buildKpiSavePayload(
  [
    { id: 1, denominator: 'ทั้งหมด' },
    { id: 2, denominator: null },
  ],
  {
    1: { numerator: '', denominator: '' },
    2: { numerator: '0', denominator: '' },
  },
  { dept_id: 20, fiscal_year: 2569, month: 12 },
)

assert.deepEqual(result.entries, [
  { dept_id: 20, kpi_id: 2, fiscal_year: 2569, month: 12, numerator: 0, denominator: null },
], 'count-only zero values should be saved as zero')
assert.deepEqual(result.clear_entries, [
  { dept_id: 20, kpi_id: 1, fiscal_year: 2569, month: 12 },
], 'cleared fields should request deletion of the previous database row')

console.log('KPI entry save tests passed')
