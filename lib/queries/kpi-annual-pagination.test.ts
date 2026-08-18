import assert from 'node:assert/strict'
import { getAnnualData, getDashboard } from './kpi'

const rows = Array.from({ length: 1001 }, () => ({
  dept_code: 'CHE',
  dept_name: 'เคมีคลินิก',
  kpi_code: 'TAT_ROUTINE',
  category: 'TAT',
  sub_code: null,
  kpi_name: 'Routine',
  target_type: 'gte' as const,
  target_val: 95,
  unit: '%',
  fiscal_year: 2569,
  month: 12,
  numerator: 1,
  denominator: 2,
  result_pct: 50,
  is_pass: false,
}))

const definitions = [
  {
    id: 1,
    code: 'TAT_ROUTINE',
    category: 'TAT',
    sub_code: null,
    name_th: 'Routine',
    target_type: 'gte' as const,
    target_val: 95,
    unit: '%',
    sort_order: 1,
    denominator: null,
  },
  {
    id: 2,
    code: 'NO_DATA',
    category: 'RISK',
    sub_code: '9.1',
    name_th: 'No data KPI',
    target_type: 'eq' as const,
    target_val: 0,
    unit: 'ครั้ง',
    sort_order: 2,
    denominator: null,
  },
]

function createQuery() {
  let start = 0
  let end = 999
  const query = {
    select: () => query,
    eq: () => query,
    not: () => query,
    in: (column: string, values: string[]) => {
      assert.equal(column, 'dept_code')
      assert.deepEqual(values, ['CHE'])
      return query
    },
    order: () => query,
    range: (nextStart: number, nextEnd: number) => {
      start = nextStart
      end = nextEnd
      return query
    },
    then: (resolve: (value: { data: typeof rows; error: null }) => unknown) =>
      Promise.resolve({ data: rows.slice(start, end + 1), error: null }).then(resolve),
  }
  return query
}

function createDefinitionQuery() {
  const query = {
    select: () => query,
    order: () => query,
    then: (resolve: (value: { data: typeof definitions; error: null }) => unknown) =>
      Promise.resolve({ data: definitions, error: null }).then(resolve),
  }
  return query
}

const supabase = {
  from: (table: string) => {
    if (table === 'kpi_definitions') return createDefinitionQuery()
    assert.equal(table, 'vw_kpi_dashboard')
    return createQuery()
  },
} as never

async function run() {
  const result = await getAnnualData(supabase, 2569)
  assert.equal(result[0]?.months[12]?.numerator, 1001, 'annual KPI query should fetch rows after the first 1,000')
  assert.equal(result[0]?.denominator_label, null, 'annual KPI type should come from the settings definition')
  assert.equal(result[0]?.months[12]?.denominator, null, 'count KPI should not use a historical denominator value')
  assert.equal(result[0]?.months[12]?.is_pass, true, 'count KPI target should compare the numerator using settings')
  assert.equal(result.some((row) => row.kpi_code === 'NO_DATA'), true, 'settings KPI without entries should still appear in annual data')
  const dashboard = await getDashboard(supabase, 2569, 12)
  assert.equal(dashboard.length, 1001, 'monthly dashboard query should fetch rows after the first 1,000')
  const scoped = await getAnnualData(supabase, 2569, undefined, new Set(), new Set(['CHE']))
  assert.equal(scoped[0]?.months[12]?.numerator, 1001, 'annual query should apply the assigned department scope')
  console.log('KPI annual pagination tests passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
