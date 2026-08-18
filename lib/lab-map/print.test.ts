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
const webUrl = 'https://example.test/staff/lab-map'

const evacuation = buildMapPrintDTO({ release, kind: 'evacuation', paperSize: 'A3', stationCode: 'office', webUrl })
assert.equal(evacuation.ok, true)
if (evacuation.ok) {
  assert.equal(evacuation.value.mode, 'safety')
  assert.ok(evacuation.value.map.routes.every((route) => route.kind === 'evacuation'))
  // ทั้งเส้นทางหลักและสำรองต้องอยู่บนแผ่นเดียวกัน
  assert.ok(evacuation.value.map.routes.some((route) => route.variant === 'primary'))
  assert.ok(evacuation.value.map.routes.some((route) => route.variant === 'alternate'))
  assert.ok(evacuation.value.map.accessPoints.some((point) => point.status === 'permanently_locked'))
  assert.ok(evacuation.value.map.structures.length > 0)
  assert.ok(!('people' in evacuation.value.map))
  // แผ่นเส้นทางหนีไฟต้องมีถังดับเพลิงและจุดรวมพล — แผ่นควบคุมการติดเชื้อไม่ต้องมี
  assert.ok(evacuation.value.map.safetyEquipment.length > 0)
  assert.ok(evacuation.value.map.assemblyPoints.length > 0)
}

// สถานีชนิด 'checkpoint' (จุดที่ผู้มาติดต่อยืนรอจริง) ไม่ใช่จุดติดตั้งป้าย — ไม่พิมพ์เป็นแผ่นแยก
const checkpointPrint = buildMapPrintDTO({ release, kind: 'evacuation', paperSize: 'A3', stationCode: 'at-blood-bank', webUrl })
assert.deepEqual(checkpointPrint, { ok: false, error: 'unknown_station' })

const infection = buildMapPrintDTO({ release, kind: 'infection_control', paperSize: 'A4', stationCode: 'office', webUrl })
assert.ok(infection.ok && infection.value.mode === 'infection' && infection.value.map.routes.length === 0)
if (infection.ok) {
  assert.equal(infection.value.map.safetyEquipment.length, 0, 'infection control sheets omit fire safety equipment')
  assert.equal(infection.value.map.assemblyPoints.length, 0, 'infection control sheets omit assembly points')
}

const visitor = buildMapPrintDTO({ release, kind: 'visitor_navigation', paperSize: 'A4', stationCode: 'office', destinationCode: 'fingerprint-molecular', webUrl })
assert.ok(visitor.ok)
if (visitor.ok) {
  const payload = JSON.stringify(visitor.value.map)
  assert.doesNotMatch(payload, /infectionClass|profileId|assignmentId/i)
  assert.ok(visitor.value.map.routes.every((route) => route.kind === 'visitor'))
  assert.equal(visitor.value.map.routes.length, 1)
}

const unknownDestination = buildMapPrintDTO({ release, kind: 'visitor_navigation', paperSize: 'A4', stationCode: 'office', destinationCode: 'fingerprint-nowhere', webUrl })
assert.deepEqual(unknownDestination, { ok: false, error: 'unknown_visitor_destination' })

const livePositionPrint = buildMapPrintDTO({
  release: {
    ...release,
    assetSnapshot: [{ code: 'extinguisher-2', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 2', x: 10, y: 20, verified: true }],
    assemblyPointSnapshot: [{ code: 'assembly-1', nameTh: 'จุดรวมพลเดิม', exitCodes: ['exit-3a'], latitude: 13, longitude: 100, verified: true }],
  },
  kind: 'evacuation', paperSize: 'A3', stationCode: 'office', webUrl,
  liveSafetyEquipment: [{ code: 'extinguisher-2', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 2', x: 110, y: 120, verified: true }],
  liveAssemblyPoints: [{ code: 'assembly-1', nameTh: 'จุดรวมพลใหม่', exitCodes: ['exit-3b'], latitude: 14, longitude: 101, verified: true }],
})
assert.ok(livePositionPrint.ok)
if (livePositionPrint.ok) {
  assert.deepEqual(
    livePositionPrint.value.map.safetyEquipment[0] && { x: livePositionPrint.value.map.safetyEquipment[0].x, y: livePositionPrint.value.map.safetyEquipment[0].y },
    { x: 110, y: 120 },
    'printed evacuation maps use the current verified equipment position',
  )
  assert.deepEqual(
    livePositionPrint.value.map.assemblyPoints[0] && { latitude: livePositionPrint.value.map.assemblyPoints[0].latitude, longitude: livePositionPrint.value.map.assemblyPoints[0].longitude },
    { latitude: 14, longitude: 101 },
    'printed evacuation maps use the current verified assembly point position',
  )
}

const missing = buildMapPrintDTO({ release, kind: 'evacuation', paperSize: 'A3', stationCode: 'unknown', webUrl })
assert.deepEqual(missing, { ok: false, error: 'missing_evacuation_preset' })
console.log('lab map print DTO tests passed')
