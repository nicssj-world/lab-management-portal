import assert from 'node:assert/strict'

import { getYearEntries } from './kpi'

const rows = Array.from({ length: 1001 }, (_, index) => ({
  id: index + 1,
  dept_id: 20,
  kpi_id: (index % 9) + 1,
  fiscal_year: 2569,
  month: 12,
  numerator: index,
  denominator: null,
  result_pct: null,
}))

const requestedRanges: Array<[number, number]> = []

function createQuery() {
  let start = 0
  let end = 999

  const query = {
    select: () => query,
    eq: (column: string, value: number) => {
      assert.equal(column, 'fiscal_year')
      assert.equal(value, 2569)
      return query
    },
    order: (column: string, options: { ascending: boolean }) => {
      assert.equal(column, 'id')
      assert.equal(options.ascending, true)
      return query
    },
    range: (nextStart: number, nextEnd: number) => {
      start = nextStart
      end = nextEnd
      requestedRanges.push([nextStart, nextEnd])
      return query
    },
    then: (resolve: (value: { data: typeof rows; error: null }) => unknown) =>
      Promise.resolve({ data: rows.slice(start, end + 1), error: null }).then(resolve),
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
  const result = await getYearEntries(supabase, 2569)

  assert.equal(result.length, rows.length)
  assert.deepEqual(requestedRanges, [[0, 999], [1000, 1999]])
  assert.equal(result.at(-1)?.id, 1001)

  console.log('kpi query tests passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
