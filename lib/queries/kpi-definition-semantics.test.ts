import assert from 'node:assert/strict'
import { normalizeKpiDashboardRows } from './kpi'

const rows = [
  {
    dept_code: 'CHE',
    dept_name: 'เคมีคลินิก',
    kpi_code: 'COUNT_LIMIT',
    category: 'RISK',
    sub_code: null,
    kpi_name: 'Count limit',
    target_type: 'gte' as const,
    target_val: 0,
    unit: 'ครั้ง',
    fiscal_year: 2569,
    month: 12,
    numerator: 5,
    denominator: 99,
    result_pct: 0,
    is_pass: null,
  },
  {
    dept_code: 'CHE',
    dept_name: 'เคมีคลินิก',
    kpi_code: 'PERCENT_EQ',
    category: 'TAT',
    sub_code: null,
    kpi_name: 'Percent equality',
    target_type: 'eq' as const,
    target_val: 100,
    unit: '%',
    fiscal_year: 2569,
    month: 12,
    numerator: 10,
    denominator: 10,
    result_pct: 0,
    is_pass: false,
  },
  {
    dept_code: 'CHE',
    dept_name: 'เคมีคลินิก',
    kpi_code: 'PERCENT_ZERO',
    category: 'RISK',
    sub_code: null,
    kpi_name: 'Zero percentage',
    target_type: 'lte' as const,
    target_val: 25,
    unit: '%',
    fiscal_year: 2569,
    month: 12,
    numerator: 0,
    denominator: 0,
    result_pct: null,
    is_pass: null,
  },
]

const definitions = [
  {
    id: 1,
    code: 'COUNT_LIMIT',
    category: 'RISK',
    sub_code: null,
    name_th: 'Count limit',
    target_type: 'gte' as const,
    target_val: 10,
    unit: 'ครั้ง',
    sort_order: 1,
    denominator: null,
  },
  {
    id: 2,
    code: 'PERCENT_EQ',
    category: 'TAT',
    sub_code: null,
    name_th: 'Percent equality',
    target_type: 'eq' as const,
    target_val: 100,
    unit: '%',
    sort_order: 2,
    denominator: 'จำนวนทั้งหมด',
  },
  {
    id: 3,
    code: 'PERCENT_ZERO',
    category: 'RISK',
    sub_code: null,
    name_th: 'Zero percentage',
    target_type: 'lte' as const,
    target_val: 25,
    unit: '%',
    sort_order: 3,
    denominator: 'จำนวนทั้งหมด',
  },
]

const normalized = normalizeKpiDashboardRows(rows as never, definitions as never)

assert.equal(normalized[0]?.denominator_label, null)
assert.equal(normalized[0]?.target_val, 10)
assert.equal(normalized[0]?.is_pass, false, 'count KPI should use numerator and current Settings target')
assert.equal(normalized[1]?.result_pct, 100, 'percentage result should be recalculated from the entry')
assert.equal(normalized[1]?.is_pass, true, 'percentage equality should use the current Settings target')
assert.equal(normalized[2]?.result_pct, null, '0/0 should have no measurable percentage')
assert.equal(normalized[2]?.is_pass, null, '0/0 should be not evaluated against the Settings target')

console.log('KPI definition semantics tests passed')
