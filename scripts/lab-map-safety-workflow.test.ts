import assert from 'node:assert/strict'
import {
  buildSafetyInspectionQueue,
  nextSafetyAssetCode,
  previousSafetyAssetCode,
} from '../lib/lab-map/safety-inspection-workflow'
import type { SafetyAssetDTO } from '../lib/lab-map/types'

const assets = [
  { id: 'b', code: 'EXT-2', nameTh: 'ถัง 2', kind: 'fire-extinguisher', spaceCode: 'room-a', x: 200, y: 120, operationalStatus: 'overdue' },
  { id: 'a', code: 'EXT-1', nameTh: 'ถัง 1', kind: 'fire-extinguisher', spaceCode: 'room-a', x: 100, y: 120, operationalStatus: 'overdue', sourceNoteTh: 'หน้าประตู' },
  { id: 'c', code: 'AED-1', nameTh: 'AED', kind: 'aed', spaceCode: 'room-b', x: 20, y: 300, operationalStatus: 'passed' },
] as SafetyAssetDTO[]

const overdueQueue = buildSafetyInspectionQueue({
  assets,
  filters: { query: '', status: 'overdue', kind: '', spaceCode: '' },
  completedAssetIds: new Set(['a']),
})

assert.deepEqual(overdueQueue.items.map(item => item.asset.code), ['EXT-1', 'EXT-2'])
assert.deepEqual(overdueQueue.progress, { completed: 1, total: 2, remaining: 1 })
assert.equal(nextSafetyAssetCode(overdueQueue, 'EXT-1'), 'EXT-2')
assert.equal(nextSafetyAssetCode(overdueQueue, 'EXT-2'), 'EXT-1', 'next wraps at the end')
assert.equal(previousSafetyAssetCode(overdueQueue, 'EXT-1'), 'EXT-2', 'previous wraps at the start')

const searchedQueue = buildSafetyInspectionQueue({
  assets,
  filters: { query: 'หน้าประตู', status: '', kind: 'fire-extinguisher', spaceCode: 'room-a' },
  completedAssetIds: new Set(),
})
assert.deepEqual(searchedQueue.items.map(item => item.asset.code), ['EXT-1'])

const emptyQueue = buildSafetyInspectionQueue({
  assets,
  filters: { query: 'ไม่พบอุปกรณ์', status: '', kind: '', spaceCode: '' },
  completedAssetIds: new Set(),
})
assert.equal(nextSafetyAssetCode(emptyQueue, 'EXT-1'), null)
assert.equal(previousSafetyAssetCode(emptyQueue, 'EXT-1'), null)

console.log('lab map safety workflow tests passed')
