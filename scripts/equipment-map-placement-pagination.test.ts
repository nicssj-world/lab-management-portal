import assert from 'node:assert/strict'
import {
  filterPlacementItems,
  paginatePlacementItems,
  placementFilterOptions,
  PLACEMENT_PAGE_SIZE,
  UNCLASSIFIED_FILTER,
} from '../lib/equipment-map/placement-pagination'

const items = Array.from({ length: 512 }, (_, index) => index + 1)

assert.equal(PLACEMENT_PAGE_SIZE, 5, 'the side panel must show only 5 equipment cards at a time')

const first = paginatePlacementItems(items, 1)
assert.deepEqual(first.items, items.slice(0, 5))
assert.equal(first.page, 1)
assert.equal(first.pageCount, 103)
assert.equal(first.from, 1)
assert.equal(first.to, 5)

const last = paginatePlacementItems(items, 103)
assert.deepEqual(last.items, items.slice(510))
assert.equal(last.from, 511)
assert.equal(last.to, 512)

const clamped = paginatePlacementItems(items, 999)
assert.equal(clamped.page, 103, 'a stale page number must be clamped after the report shrinks')

const filterable = [
  { id: '1', department: 'เคมีคลินิก', classification: 'A', needsCalibration: true },
  { id: '2', department: 'เคมีคลินิก', classification: 'B', needsCalibration: false },
  { id: '3', department: 'โลหิตวิทยา', classification: 'A', needsCalibration: true },
  { id: '4', department: 'โลหิตวิทยา', classification: null, needsCalibration: false },
]
assert.deepEqual(filterPlacementItems(filterable, 'เคมีคลินิก', 'A').map((item) => item.id), ['1'])
assert.deepEqual(filterPlacementItems(filterable, 'โลหิตวิทยา', UNCLASSIFIED_FILTER).map((item) => item.id), ['4'])
assert.deepEqual(filterPlacementItems(filterable, '', '', true).map((item) => item.id), ['1', '3'])
assert.deepEqual(filterPlacementItems(filterable, 'เคมีคลินิก', 'A', true).map((item) => item.id), ['1'])
assert.deepEqual(placementFilterOptions(filterable), {
  departments: ['เคมีคลินิก', 'โลหิตวิทยา'],
  classifications: ['A', 'B'],
  hasUnclassified: true,
})

console.log('equipment placement pagination passed')
