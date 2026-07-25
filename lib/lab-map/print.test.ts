import assert from 'node:assert/strict'
import { LAB_MAP_VERSION } from './manifest'
import { currentManifestHash } from './release'
import { buildMapPrintDTO } from './print'
import type { MapReleaseDTO } from './types'

const release: MapReleaseDTO = {
  versionCode: LAB_MAP_VERSION, status: 'published', manifestHash: currentManifestHash(),
  effectiveDate: '2026-07-26', reviewedBy: 'r1', approvedBy: 'a1', approvedAt: '2026-07-26T02:00:00Z',
  reviewerName: 'ผู้ทบทวน', approverName: 'ผู้อนุมัติ',
}

const evacuation = buildMapPrintDTO({ release, kind: 'evacuation', paperSize: 'A3', stationCode: 'office', webUrl: 'https://example.test/lab-map/office' })
assert.equal(evacuation.ok, true)
if (evacuation.ok) {
  assert.equal(evacuation.value.mode, 'safety')
  assert.ok(evacuation.value.map.routes.every((route) => route.kind === 'evacuation'))
  assert.ok(evacuation.value.map.accessPoints.some((point) => point.code === 'door-electrical-control'))
  assert.ok(!('people' in evacuation.value.map))
}

const infection = buildMapPrintDTO({ release, kind: 'infection_control', paperSize: 'A4', stationCode: 'office', webUrl: 'https://example.test/lab-map/office' })
assert.ok(infection.ok && infection.value.mode === 'infection' && infection.value.map.routes.length === 0)

const visitor = buildMapPrintDTO({ release, kind: 'visitor_navigation', paperSize: 'A4', stationCode: 'office', destinationCode: 'fingerprint-central-left', webUrl: 'https://example.test/lab-map/office' })
assert.ok(visitor.ok)
if (visitor.ok) {
  const payload = JSON.stringify(visitor.value.map)
  assert.doesNotMatch(payload, /BSL2|PCR|infectionClass|door-electrical-control|profileId/i)
  assert.ok(visitor.value.map.routes.every((route) => route.kind === 'visitor'))
}

const missing = buildMapPrintDTO({ release, kind: 'evacuation', paperSize: 'A3', stationCode: 'unknown', webUrl: 'x' })
assert.deepEqual(missing, { ok: false, error: 'missing_evacuation_preset' })
console.log('lab map print DTO tests passed')
