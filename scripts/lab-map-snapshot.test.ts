import assert from 'node:assert/strict'
import { manifestHashForSnapshots, validatePublishableRelease } from '../lib/lab-map/release'
import type { MapReleaseDTO } from '../lib/lab-map/types'

const assets = [{ code: 'AED-01', kind: 'aed' as const, nameTh: 'AED', x: 10, y: 20, verified: true }]
const assembly = [{ code: 'AP-01', nameTh: 'จุดรวมพล', detailTh: 'หน้าอาคาร', exitCodes: ['exit-3a'], latitude: 13.1, longitude: 100.9, verified: true }]
const base: MapReleaseDTO = {
  versionCode: 'F3-TEST', status: 'draft', effectiveDate: '2026-07-26', reviewedBy: 'reviewer',
  approvedBy: 'approver', approvedAt: '2026-07-26T00:00:00.000Z', notes: null,
  manifestHash: manifestHashForSnapshots(assets, assembly), assetSnapshot: assets, assemblyPointSnapshot: assembly,
}

assert.deepEqual(validatePublishableRelease(base), [])
assert.match(validatePublishableRelease({ ...base, assetSnapshot: [{ ...assets[0], verified: false }] })[0], /อุปกรณ์/)
assert.match(validatePublishableRelease({ ...base, assemblyPointSnapshot: [{ ...assembly[0], latitude: null }] })[0], /จุดรวมพล/)
assert.notEqual(manifestHashForSnapshots(assets, assembly), manifestHashForSnapshots([{ ...assets[0], x: 11 }], assembly))

console.log('lab map snapshot tests passed')
