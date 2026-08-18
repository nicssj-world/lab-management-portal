import assert from 'node:assert/strict'
import { getAnnualData } from './kpi'

const rows = [{
  dept_code: 'CHE',
  dept_name: 'เคมีคลินิก',
  kpi_code: 'RISK_LOWRISK',
  category: 'RISK',
  sub_code: '4.3',
  kpi_name: 'Low Risk C-D',
  target_type: 'lte' as const,
  target_val: 25,
  unit: '%',
  fiscal_year: 2569,
  month: 12,
  numerator: 0,
  denominator: 0,
  result_pct: null,
  is_pass: null,
}]

const definitions = [{
  id: 1,
  code: 'RISK_LOWRISK',
  category: 'RISK',
  sub_code: '4.3',
  name_th: 'Low Risk C-D',
  target_type: 'lte' as const,
  target_val: 25,
  unit: '%',
  sort_order: 1,
  denominator: 'จำนวนทั้งหมด',
}]

function createRowsQuery() {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    range: () => query,
    then: (resolve: (value: { data: typeof rows; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  }
  return query
}

function createDefinitionsQuery() {
  const query = {
    select: () => query,
    order: () => query,
    then: (resolve: (value: { data: typeof definitions; error: null }) => unknown) =>
      Promise.resolve({ data: definitions, error: null }).then(resolve),
  }
  return query
}

const supabase = {
  from: (table: string) => table === 'kpi_definitions' ? createDefinitionsQuery() : createRowsQuery(),
} as never

async function run() {
  const result = await getAnnualData(supabase, 2569, 'CHE')
  const month = result[0]?.months[12]
  assert.equal(month?.numerator, 0)
  assert.equal(month?.denominator, 0)
  assert.equal(month?.result_pct, null, 'annual 0/0 should have no measurable percentage')
  assert.equal(month?.is_pass, null, 'annual 0/0 should be not evaluated')

  console.log('KPI zero-zero annual tests passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
