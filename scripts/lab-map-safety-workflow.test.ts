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

const assetsWithLatestEvidence = assets.map(asset => asset.id === 'a' ? {
  ...asset,
  latestInspection: {
    id: 'inspection-a', assetId: 'a', result: 'passed' as const,
    inspectedOn: '2026-08-23', nextInspectionDate: '2026-09-22', expiresOn: null,
    note: null, photoUrl: null, inspectedBy: 'inspector-a', inspectorName: null,
    createdAt: '2026-08-23T00:00:00.000Z',
  },
} : asset) as SafetyAssetDTO[]
const latestEvidenceQueue = buildSafetyInspectionQueue({
  assets: assetsWithLatestEvidence,
  filters: { query: '', status: '', kind: '', spaceCode: '' },
  completedAssetIds: new Set(),
  countLatestInspections: true,
})
assert.deepEqual(latestEvidenceQueue.progress, { completed: 1, total: 3, remaining: 2 })
assert.equal(latestEvidenceQueue.items.find(item => item.asset.id === 'a')?.completed, true)

const emptyQueue = buildSafetyInspectionQueue({
  assets,
  filters: { query: 'ไม่พบอุปกรณ์', status: '', kind: '', spaceCode: '' },
  completedAssetIds: new Set(),
})
assert.equal(nextSafetyAssetCode(emptyQueue, 'EXT-1'), null)
assert.equal(previousSafetyAssetCode(emptyQueue, 'EXT-1'), null)

console.log('lab map safety workflow tests passed')
