import assert from 'node:assert/strict'
import { fetchAllPages } from '../lib/equipment-map/pagination'

async function main() {
  const source = Array.from({ length: 512 }, (_, index) => index + 1)
  const requestedRanges: Array<[number, number]> = []

  const rows = await fetchAllPages(async (from, to) => {
    requestedRanges.push([from, to])
    return source.slice(from, to + 1)
  }, 500)

  assert.equal(rows.length, 512, 'pagination must return rows beyond the PostgREST 500-row response cap')
  assert.deepEqual(requestedRanges, [[0, 499], [500, 999]], 'pagination must continue with the next non-overlapping range')
}

void main().then(() => console.log('equipment map pagination passed'))
