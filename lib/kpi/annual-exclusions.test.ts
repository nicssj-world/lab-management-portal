import assert from 'node:assert/strict'
import { filterAnnualRowsByExclusions } from './annual-exclusions'

const rows = [
  { dept_code: 'OPD', kpi_code: 'RISK_BLOOD', month: 12 },
  { dept_code: 'OPD', kpi_code: 'RISK_ID_OPD', month: 12 },
] as never[]

const result = filterAnnualRowsByExclusions(
  rows,
  new Map([['OPD', { id: 20 }]]),
  new Map([
    ['RISK_BLOOD', { id: 6 }],
    ['RISK_ID_OPD', { id: 7 }],
  ]),
  new Set(['20|6']),
)

assert.deepEqual(result, [rows[1]], 'annual data should omit KPI rows excluded for the selected department')
console.log('KPI annual exclusion tests passed')
