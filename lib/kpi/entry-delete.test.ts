import assert from 'node:assert/strict'
import { deleteEntries } from '../queries/kpi'

const calls: Array<{ dept_id: number; fiscal_year: number; month: number; kpi_ids: number[] }> = []

function createQuery() {
  const filters: Record<string, number | number[]> = {}
  const query = {
    delete: () => query,
    eq: (column: string, value: number) => {
      filters[column] = value
      return query
    },
    in: (column: string, values: number[]) => {
      assert.equal(column, 'kpi_id')
      calls.push({
        dept_id: filters.dept_id as number,
        fiscal_year: filters.fiscal_year as number,
        month: filters.month as number,
        kpi_ids: values,
      })
      return Promise.resolve({ error: null })
    },
  }
  return query
}

const supabase = {
  from: (table: string) => {
    assert.equal(table, 'kpi_entries')
    return createQuery()
  },
} as never

async function run() {
  await deleteEntries(supabase, [
    { dept_id: 20, kpi_id: 1, fiscal_year: 2569, month: 12 },
    { dept_id: 20, kpi_id: 5, fiscal_year: 2569, month: 12 },
  ])

  assert.deepEqual(calls, [{ dept_id: 20, fiscal_year: 2569, month: 12, kpi_ids: [1, 5] }])
  console.log('KPI entry delete tests passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
