import assert from 'node:assert/strict'
import {
  LAB_ACCESS_POINTS,
  LAB_LABELS,
  LAB_ROUTE_PRESETS,
  LAB_SPACES,
  LAB_STATIONS,
  LAB_STRUCTURES,
  LAB_ZONES,
  evacuationPresetsForStation,
  resolveRoutePreset,
  stationForCheckpoint,
} from '../lib/lab-map/manifest'
import { EVACUATION_RESTRICTED_SPACE_CODES, LAB_ASSEMBLY_POINTS, LAB_SAFETY_EQUIPMENT } from '../lib/lab-map/safety-assets'
import {
  barrierSegments,
  boundingBox,
  boxContains,
  crossedBarriers,
  sameBoxSize,
  samePoint,
} from '../lib/lab-map/geometry'
import { computeManifestHash } from '../lib/lab-map/release'
import { validateLabMapManifest } from '../lib/lab-map/validate'

assert.deepEqual(validateLabMapManifest(), [])
assert.equal(new Set(LAB_SPACES.map((space) => space.code)).size, LAB_SPACES.length)

// ── ป้องกันการแก้เรขาคณิตของผังโดยไม่ตั้งใจ ──
// LAB_SPACES hash ครอบคลุมทั้งรูปทรง/พิกัดและ workUnits ในอ็อบเจ็กต์เดียวกัน — การแก้ workUnits
// ที่ตั้งใจ (เช่น เพิ่มหน่วยงานเข้าไปในห้องที่มีอยู่) ต้องอัปเดตค่าเปรียบเทียบนี้ด้วย ไม่ใช่แค่พิกัดขยับ
// ถ้า hash เปลี่ยนโดยไม่มีการแก้ workUnits ที่ตั้งใจ แปลว่าเรขาคณิตที่อนุมัติแล้วถูกแก้ — ต้องตรวจสอบก่อน
// แก้ไซซ์/ตำแหน่งของ 'office' และ 'equipment-wash' และ 'lift-1' ให้ชนขอบห้องข้างเคียงพอดี
// (เดิมมี overlap/ช่องว่างเล็ก ๆ 1-4 หน่วยที่ทำให้เส้นขอบห้องซ้อนกันไม่สนิท — ผู้ใช้ส่งภาพตัวอย่างมาให้ตรวจ) แล้วอัปเดตค่านี้
assert.equal(computeManifestHash(LAB_SPACES), '19f80a7b41db2b2e11185a2338a46b81f184c9e0e323faf7ee54fee0a3499eb1', 'LAB_SPACES must match the current approved geometry + work-unit assignments')
// เพิ่มประตูห้องประชุม (door-meeting-room + leaf) แล้วอัปเดตค่าเปรียบเทียบนี้ — ห้องนี้เดิมไม่มี
// ประตูเลย (ผนังปิดทึบทั้งสี่ด้าน) เป็นข้อบกพร่องที่แก้แล้ว ไม่ใช่การขยับพิกัดที่มีอยู่เดิม
// เปลี่ยนบานสวิงประตูห้องประชุมให้เข้าไปในห้องแทนสวิงออกโถงกลาง (ตามภาพอ้างอิงที่ผู้ใช้ยืนยัน) แล้วอัปเดตค่านี้
// ย้ายผนัง/ประตู/ธรณีประตูฝั่งเหนือของ ห้องล้างอุปกรณ์ จาก y=205 มาเป็น y=208 ให้ตรงกับผนังต่อเนื่องเดิม
// และตัดปลายผนังลอย (455,208)-(455,263) ที่ไม่เชื่อมกับสิ่งใด ออก แล้วอัปเดตค่านี้
assert.equal(computeManifestHash(LAB_STRUCTURES), '30d1739e3403c4441d89455e1adcea69ae6dcc50582ca8d5f6b4cbcc90b4e345', 'LAB_STRUCTURES must match the current approved geometry, including the inward-swinging meeting-room door and the equipment-wash wall cleanup')
// ป้าย "ประตูหนีไฟ" ของ 3B/3C เดิมวางซ้อนทับไอคอนทางออกพอดี (ผู้ใช้ส่งภาพมาให้ตรวจ) — ขยับให้พ้นไอคอนแล้วอัปเดตค่านี้
assert.equal(computeManifestHash(LAB_LABELS), 'c95ec251f0d9b7d50e727d1042c0b72d7ea9db3444c5cbe506d95d8868a0ed78', 'LAB_LABELS geometry must match the current approved layout, including the exit-3B/3C door-label fix')

// ── ข้อบกพร่องที่รายงานไว้ ต้องถูกแก้ในเรขาคณิต ──

const box = (code: string) => {
  const shape = LAB_SPACES.find((space) => space.code === code)?.shape
  const result = shape ? boundingBox(shape) : null
  assert.ok(result, `space ${code} must exist with a measurable shape`)
  return result
}

// ห้องน้ำหนึ่งห้องซ้อนอยู่ในห้องหัวหน้ากลุ่มงาน
assert.equal(
  LAB_SPACES.find((space) => space.code === 'group-head-restroom')?.nestedIn,
  'group-head-office',
)
assert.ok(boxContains(box('group-head-office'), box('group-head-restroom')))

// ลิฟท์ 3 และลิฟท์ 4 ขนาดเท่ากัน
assert.ok(sameBoxSize(box('lift-3'), box('lift-4')), 'lift 3 and lift 4 must be the same size')

// ห้องอาหารว่างผู้บริจาคซ้อนอยู่ในห้องรับบริจาคเลือดทั้งหมด
assert.equal(
  LAB_SPACES.find((space) => space.code === 'donor-snack-room')?.nestedIn,
  'blood-donation-room',
)
assert.ok(boxContains(box('blood-donation-room'), box('donor-snack-room')))

// สัญลักษณ์ล็อคถาวรผูกกับบานประตู ไม่ใช่ห้องควบคุมไฟฟ้า
const lockedPoints = LAB_ACCESS_POINTS.filter((point) => point.status === 'permanently_locked')
assert.equal(lockedPoints.length, 1)
assert.equal(lockedPoints[0].kind, 'door')
assert.notEqual(
  LAB_SPACES.find((space) => space.code === 'electrical-control')?.controlled,
  true,
)
assert.doesNotMatch(lockedPoints[0].code, /^space-/)

// มีแนวกั้นจุดสแกนอยู่ในชั้นโครงสร้าง ไม่ได้ทำเป็นห้องปลอม
const barriers = LAB_STRUCTURES.filter((item) => item.kind === 'scanner-barrier')
assert.ok(barriers.length >= 3, 'scanner-control boundaries are part of the structural layer')
assert.ok(LAB_STRUCTURES.some((item) => item.kind === 'door-swing'), 'door swings are drawn')
assert.ok(LAB_STRUCTURES.some((item) => item.kind === 'exterior-wall'), 'exterior walls are drawn')

// ── ป้ายชื่อเขียนเอง ไม่มีการตัดคำอัตโนมัติเหลือสามบรรทัด ──
for (const space of LAB_SPACES) {
  const labels = LAB_LABELS.filter((item) => item.spaceCode === space.code)
  assert.equal(labels.length, 1, `space ${space.code} must have exactly one authored label`)
  assert.ok(labels[0].lines.every((line) => line.trim().length > 0))
}
assert.equal(
  LAB_LABELS.find((item) => item.code === 'label-locker-room')?.lines.length,
  3,
  'authored labels may exceed two lines without being truncated',
)
assert.ok(LAB_LABELS.some((item) => item.rotate === -90), 'rotated labels are authored, not derived')

const storageZone = LAB_ZONES.find((zone) => zone.code === 'storage-zone')
assert.ok(storageZone?.spaceCodes.includes('cold-material-reagent-store'))
assert.ok(storageZone?.spaceCodes.includes('material-store'))
assert.ok(storageZone?.spaceCodes.includes('material-reagent-store'))

// ── เส้นทางผู้มาติดต่อ ──
// ประตูห้องประชุมเป็นข้อยกเว้นเดียวที่อนุมัติแล้ว (ไม่มีจุดสแกน) — ดู APPROVED_NON_FINGERPRINT_VISITOR_DESTINATIONS ใน validate.ts
const APPROVED_NON_FINGERPRINT_DESTINATION = 'door-meeting-room'
const barrierGeometry = barrierSegments(LAB_STRUCTURES)
for (const preset of LAB_ROUTE_PRESETS.filter((item) => item.kind === 'visitor')) {
  const endpoint = LAB_ACCESS_POINTS.find((point) => point.code === preset.destinationCode)
  if (preset.destinationCode !== APPROVED_NON_FINGERPRINT_DESTINATION) {
    assert.ok(endpoint && endpoint.kind === 'fingerprint', `${preset.code} ends at a fingerprint point`)
  } else {
    assert.ok(endpoint && endpoint.kind === 'door' && endpoint.status === 'open', `${preset.code} ends at the approved open door`)
  }
  const last = preset.polyline[preset.polyline.length - 1]
  assert.ok(endpoint && samePoint(last, [endpoint.x, endpoint.y]), `${preset.code} stops exactly at its checkpoint`)
  assert.equal(crossedBarriers(preset.polyline, barrierGeometry), 0, `${preset.code} never crosses a barrier`)
  const station = LAB_STATIONS.find((item) => item.code === preset.fromStationCode)
  assert.ok(station && samePoint(preset.polyline[0], [station.x, station.y]), `${preset.code} starts at its station`)
}

// ── ทางหนีไฟ: ทุกสถานีต้องมีทั้งเส้นทางหลักและเส้นทางสำรอง ──
for (const station of LAB_STATIONS) {
  const { primary, alternate } = evacuationPresetsForStation(station.code)
  assert.ok(primary, `station ${station.code} has a primary evacuation preset`)
  assert.ok(alternate, `station ${station.code} has an alternate evacuation preset`)
  assert.notEqual(primary?.destinationCode, alternate?.destinationCode)
}
assert.deepEqual(evacuationPresetsForStation('no-such-station'), { primary: null, alternate: null })

assert.ok(LAB_ROUTE_PRESETS.every((preset) => !preset.pointCodes.includes(lockedPoints[0].code)))

assert.equal(
  resolveRoutePreset({ kind: 'visitor', stationCode: 'office', destinationCode: 'fingerprint-molecular' })?.code,
  'visitor-office-molecular',
)
assert.equal(
  resolveRoutePreset({ kind: 'evacuation', stationCode: 'unknown', destinationCode: 'exit-3a' }),
  null,
)

// ── สถานีชนิด 'checkpoint' — จุดที่ผู้มาติดต่อยืนรอจริง ต้องอยู่บนพิกัดจุดสแกนเป๊ะ ๆ ──
const checkpointStations = LAB_STATIONS.filter((station) => station.kind === 'checkpoint')
assert.equal(checkpointStations.length, 6, 'six checkpoint stations, one per visitor destination checkpoint')
for (const station of checkpointStations) {
  assert.ok(station.checkpointCode, `${station.code} names its checkpoint`)
  const point = LAB_ACCESS_POINTS.find((item) => item.code === station.checkpointCode)
  assert.ok(point, `${station.code} references an existing access point`)
  assert.ok(point && samePoint([station.x, station.y], [point.x, point.y]), `${station.code} sits exactly on its checkpoint coordinate`)
  assert.equal(stationForCheckpoint(station.checkpointCode ?? null), station.code)
}
assert.equal(stationForCheckpoint(null), 'office', 'a missing checkpoint fails closed to the office plan')
assert.equal(stationForCheckpoint('fingerprint-nowhere'), 'office', 'an unmapped checkpoint fails closed to the office plan')
// สถานีติดตั้งป้ายเดิมสามจุดต้องยังอยู่ครบ ไม่ได้ถูกแทนที่โดยสถานี checkpoint ใหม่
// (meeting-room เป็นสถานีติดตั้งป้ายจุดที่สี่ที่เพิ่มเข้ามา — มีจุดสแกนของตัวเองแยกต่างหาก)
const installationStations = LAB_STATIONS.filter((station) => station.kind === 'installation')
assert.deepEqual(installationStations.map((station) => station.code).sort(), ['central-corridor', 'meeting-room', 'office', 'south-corridor'])

// ── ประตูห้องประชุม (ข้อยกเว้นเดียวที่อนุมัติแล้ว — ไม่มีจุดสแกนนิ้วมือ) ──
const meetingRoomDoor = LAB_ACCESS_POINTS.find((point) => point.code === 'door-meeting-room')
assert.ok(meetingRoomDoor && meetingRoomDoor.kind === 'door' && meetingRoomDoor.status === 'open', 'the meeting-room door is a plain open door, not a fingerprint checkpoint')
const meetingRoomStation = LAB_STATIONS.find((station) => station.code === 'meeting-room')
assert.equal(meetingRoomStation?.checkpointCode, 'door-meeting-room', 'the meeting-room station is wired to its own door so its evacuation plan is used, not the office\'s')
assert.equal(stationForCheckpoint('door-meeting-room'), 'meeting-room')

// ── อุปกรณ์ความปลอดภัย ──
assert.equal(LAB_SAFETY_EQUIPMENT.length, 11, 'eleven fire extinguishers were transcribed from the wall-mounted plan')
assert.ok(LAB_SAFETY_EQUIPMENT.every((item) => item.verified === false), 'no equipment position is confirmed on-site yet')
assert.ok(LAB_SAFETY_EQUIPMENT.every((item) => item.sourceNoteTh && item.sourceNoteTh.length > 0), 'every equipment item cites where it came from')
assert.equal(new Set(LAB_SAFETY_EQUIPMENT.map((item) => item.code)).size, LAB_SAFETY_EQUIPMENT.length)

// ── ลิฟต์ที่ห้ามใช้ขณะเกิดเหตุ ต้องอ้างรหัสห้องลิฟต์ที่มีอยู่จริงทั้งสี่ตัว ──
assert.deepEqual([...EVACUATION_RESTRICTED_SPACE_CODES].sort(), ['lift-1', 'lift-2', 'lift-3', 'lift-4'])
for (const code of EVACUATION_RESTRICTED_SPACE_CODES) {
  assert.ok(LAB_SPACES.some((space) => space.code === code), `${code} exists as a real space`)
}

// ── จุดรวมพลต้องครอบคลุมทางออกทั้งสามจุด ──
const exitCodes = LAB_ACCESS_POINTS.filter((point) => point.kind === 'exit').map((point) => point.code)
const assembledExitCodes = new Set(LAB_ASSEMBLY_POINTS.flatMap((assembly) => assembly.exitCodes))
for (const exitCode of exitCodes) {
  assert.ok(assembledExitCodes.has(exitCode), `${exitCode} has an assigned assembly point`)
}

console.log('lab map domain tests passed')
