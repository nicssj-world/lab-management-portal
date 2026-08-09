import assert from 'node:assert/strict'
import { paginateRegistryItems, REGISTRY_PAGE_SIZE } from './registry-pagination'

const rows = Array.from({ length: 45 }, (_, index) => `row-${index + 1}`)

assert.equal(REGISTRY_PAGE_SIZE, 20)

const firstPage = paginateRegistryItems(rows, 1)
assert.deepEqual(firstPage.items, rows.slice(0, 20))
assert.deepEqual(
  { currentPage: firstPage.currentPage, pageCount: firstPage.pageCount, from: firstPage.from, to: firstPage.to },
  { currentPage: 1, pageCount: 3, from: 1, to: 20 },
)

const lastPage = paginateRegistryItems(rows, 99)
assert.deepEqual(lastPage.items, rows.slice(40))
assert.deepEqual(
  { currentPage: lastPage.currentPage, pageCount: lastPage.pageCount, from: lastPage.from, to: lastPage.to },
  { currentPage: 3, pageCount: 3, from: 41, to: 45 },
)

const emptyPage = paginateRegistryItems([], 1)
assert.deepEqual(emptyPage, { items: [], currentPage: 1, pageCount: 1, from: 0, to: 0 })

console.log('chemical-safety registry pagination: ok')
