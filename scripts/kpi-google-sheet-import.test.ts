import assert from 'node:assert/strict'
import * as importer from '../lib/kpi-import/google-sheet-2569'

type Extractor = (deptCode: string, rows: Array<Array<unknown>>) => Array<{
  deptCode: string
  kpiCode: string
  month: number
  numerator: number
  denominator: number | null
}>

const extract = (importer as unknown as { extractKpi2569Sheet?: Extractor }).extractKpi2569Sheet
assert.equal(typeof extract, 'function', 'Google Sheet KPI extractor should be available for deterministic import testing')

const extract2568 = (importer as unknown as { extractKpi2568Sheet?: Extractor }).extractKpi2568Sheet
assert.equal(typeof extract2568, 'function', 'FY2568 Google Sheet KPI extractor should be available for deterministic import testing')

const rows = Array.from({ length: 28 }, () => Array(16).fill(null))
rows[2][4] = 100   // 1.1 numerator, October
rows[3][4] = 125   // 1.1 denominator, October
rows[14][4] = 0    // error report, October; zero is valid data
rows[20][4] = 3    // 4.2 numerator, October
rows[21][4] = 12   // 4.2 denominator, October
rows[26][4] = 2    // 4.4 numerator, October

const entries = extract!('OUT', rows)

assert.deepEqual(entries, [
  { deptCode: 'OUT', kpiCode: 'TAT_ROUTINE', month: 10, numerator: 100, denominator: 125 },
  { deptCode: 'OUT', kpiCode: 'ERR_REPORT', month: 10, numerator: 0, denominator: 125 },
  { deptCode: 'OUT', kpiCode: 'RISK_NEARMISS', month: 10, numerator: 3, denominator: 12 },
  { deptCode: 'OUT', kpiCode: 'RISK_MODERATE', month: 10, numerator: 2, denominator: null },
], 'extractor should map raw KPI rows, preserve zero, and ignore blank source cells')

const rows2568 = Array.from({ length: 24 }, () => Array(16).fill(null))
rows2568[2][4] = 100
rows2568[3][4] = 125
rows2568[14][4] = 0
rows2568[20][4] = 3
rows2568[21][4] = 12
rows2568[23][4] = 2

assert.deepEqual(extract2568!('OUT', rows2568), [
  { deptCode: 'OUT', kpiCode: 'TAT_ROUTINE', month: 10, numerator: 100, denominator: 125 },
  { deptCode: 'OUT', kpiCode: 'ERR_REPORT', month: 10, numerator: 0, denominator: 125 },
  { deptCode: 'OUT', kpiCode: 'RISK_NEARMISS', month: 10, numerator: 3, denominator: 12 },
  { deptCode: 'OUT', kpiCode: 'RISK_SENTINEL', month: 10, numerator: 2, denominator: null },
], 'FY2568 extractor should map the shorter risk section without assigning 4.3 to a newer KPI')

console.log('KPI Google Sheet import tests passed')
