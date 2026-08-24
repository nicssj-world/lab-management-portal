import assert from 'node:assert/strict'
import { paginateVisitorLogs, prioritizeOpenVisitorLogs, VISITOR_PAGE_SIZE } from './pagination'

const rows = Array.from({ length: 105 }, (_, index) => index + 1)

assert.equal(VISITOR_PAGE_SIZE, 50)

const first = paginateVisitorLogs(rows, 1)
assert.deepEqual(first, {
  items: rows.slice(0, 50),
  page: 1,
  pageCount: 3,
  pageSize: 50,
  total: 105,
  from: 1,
  to: 50,
})

const last = paginateVisitorLogs(rows, 99)
assert.deepEqual(last, {
  items: rows.slice(100),
  page: 3,
  pageCount: 3,
  pageSize: 50,
  total: 105,
  from: 101,
  to: 105,
})

const empty = paginateVisitorLogs([], 1)
assert.deepEqual(empty, {
  items: [],
  page: 1,
  pageCount: 1,
  pageSize: 50,
  total: 0,
  from: 0,
  to: 0,
})

const ordered = prioritizeOpenVisitorLogs([
  { id: 'closed', entered_at: '2026-08-25T10:00:00.000Z', exited_at: '2026-08-25T11:00:00.000Z' },
  { id: 'open-old', entered_at: '2026-08-24T10:00:00.000Z', exited_at: null },
  { id: 'open-new', entered_at: '2026-08-25T09:00:00.000Z', exited_at: null },
])
assert.deepEqual(ordered.map((row) => row.id), ['open-new', 'open-old', 'closed'])

console.log('visitor pagination tests passed')
