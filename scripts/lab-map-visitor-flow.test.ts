import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { DEPARTMENTS } from '../lib/validations/user-schema'
import { LAB_ACCESS_POINTS, LAB_ROUTE_PRESETS, LAB_SPACES, LAB_STATIONS, stationForCheckpoint } from '../lib/lab-map/manifest'
import {
  GROUP_HEAD_CONTACT_DEPT,
  VISITOR_CHECKPOINT_BY_DEPARTMENT,
  buildVisitorLabMapDTO,
  resolveVisitorDestination,
} from '../lib/lab-map/visitor'

// ── ตารางหน่วยงาน → จุดสแกน → สถานีความปลอดภัย กำหนดไว้ตรง ๆ ──
const EXPECTED: Record<string, { checkpointCode: string; safetyStationCode: string }> = {
  'สำนักงานกลุ่มงานเทคนิคการแพทย์': { checkpointCode: 'fingerprint-office', safetyStationCode: 'office' },
  'งานเคมีคลินิก': { checkpointCode: 'fingerprint-central-lab', safetyStationCode: 'at-central-lab' },
  'งานโลหิตวิทยาคลินิก': { checkpointCode: 'fingerprint-central-lab', safetyStationCode: 'at-central-lab' },
  'งานจุลทรรศนศาสตร์คลินิก': { checkpointCode: 'fingerprint-central-lab', safetyStationCode: 'at-central-lab' },
  'งานภูมิคุ้มกันวิทยาคลินิก': { checkpointCode: 'fingerprint-clinical-immunology', safetyStationCode: 'at-clinical-immunology' },
  'งานอณูชีววิทยา': { checkpointCode: 'fingerprint-molecular', safetyStationCode: 'at-molecular' },
  'งานจุลชีววิทยา': { checkpointCode: 'fingerprint-microbiology', safetyStationCode: 'at-microbiology' },
  'งานคลังเลือด': { checkpointCode: 'fingerprint-blood-bank', safetyStationCode: 'at-blood-bank' },
  'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ': { checkpointCode: 'fingerprint-special-testing', safetyStationCode: 'at-special-testing' },
}

for (const [department, expected] of Object.entries(EXPECTED)) {
  const result = resolveVisitorDestination(department)
  assert.equal(result?.checkpointCode, expected.checkpointCode, `${department} → ${expected.checkpointCode}`)
  assert.ok(result && result.directionsTh.length > 0, `${department} has Thai directions`)
  assert.ok(result?.routeCode, `${department} has an approved route`)
  // การแก้บั๊กสำคัญ: จุด "คุณอยู่ที่นี่" ของแผนหนีไฟต้องตรงกับตำแหน่งจริงที่ผู้มาติดต่อยืนรอ
  // ไม่ใช่แผนของสำนักงานเสมอไป (ยกเว้นหน่วยงานที่จุดสแกนคือสำนักงานเอง)
  assert.equal(result?.safetyStationCode, expected.safetyStationCode, `${department} safety station`)
  assert.equal(stationForCheckpoint(expected.checkpointCode), expected.safetyStationCode)
}

// ทุกสถานีชนิด checkpoint ต้องมี preset หนีไฟทั้งหลักและสำรอง — ไม่มี checkpoint ไหนตกไปที่ 'office' เงียบ ๆ
for (const station of LAB_STATIONS.filter((item) => item.kind === 'checkpoint')) {
  const presets = LAB_ROUTE_PRESETS.filter((route) => route.kind === 'evacuation' && route.fromStationCode === station.code)
  assert.ok(presets.some((route) => route.variant === 'primary'), `${station.code} has a primary evacuation preset`)
  assert.ok(presets.some((route) => route.variant === 'alternate'), `${station.code} has an alternate evacuation preset`)
}

// การแก้ที่สำคัญ: งานอณูชีววิทยาไปที่แนวกั้นข้างโซน PPE ใต้ Central Lab
// ไม่ใช่จุดที่ขอบห้องปฏิบัติการภูมิคุ้มกันวิทยาคลินิกซึ่งเป็นคนละห้อง
const molecular = LAB_ACCESS_POINTS.find((point) => point.code === 'fingerprint-molecular')
const immunology = LAB_ACCESS_POINTS.find((point) => point.code === 'fingerprint-clinical-immunology')
assert.notEqual(resolveVisitorDestination('งานอณูชีววิทยา')?.checkpointCode, 'fingerprint-clinical-immunology')
assert.ok(molecular && immunology && (molecular.x !== immunology.x || molecular.y !== immunology.y))
const ppe = LAB_SPACES.find((space) => space.code === 'ppe-zone')
assert.ok(ppe?.shape.type === 'rect' && molecular.x >= ppe.shape.x && molecular.y < ppe.shape.y,
  'the molecular checkpoint sits on the barrier beside the PPE zone, below Central Lab')

// ── fail closed ──
for (const unmapped of [
  'งานบริการผู้ป่วยนอก',
  'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
  'อื่น ๆ',
  'free text',
  '',
]) {
  assert.equal(resolveVisitorDestination(unmapped), null, `${unmapped} has no approved mapping`)
}
for (const department of Object.keys(VISITOR_CHECKPOINT_BY_DEPARTMENT)) {
  if (department === GROUP_HEAD_CONTACT_DEPT) continue
  assert.ok(DEPARTMENTS.includes(department as (typeof DEPARTMENTS)[number]), `${department} is a real department`)
}

// ── ปลายทาง "พบหัวหน้ากลุ่มงานเทคนิคการแพทย์" — ข้อยกเว้นเดียวที่อนุมัติแล้ว ไม่มีจุดสแกนนิ้วมือ ──
// ตั้งใจไม่อยู่ใน DEPARTMENTS เพราะไม่ใช่แผนก/หน่วยงานสังกัดจริงของเจ้าหน้าที่ (ใช้ทั่วระบบ:
// โปรไฟล์ ทะเบียนเครื่องมือ รายงานเอกสาร ฯลฯ) เป็นตัวเลือกเฉพาะฟอร์มผู้มาติดต่อเท่านั้น
assert.ok(!DEPARTMENTS.includes(GROUP_HEAD_CONTACT_DEPT as (typeof DEPARTMENTS)[number]),
  'the group-head destination is deliberately kept out of the shared DEPARTMENTS enum')
const groupHead = resolveVisitorDestination(GROUP_HEAD_CONTACT_DEPT)
assert.equal(groupHead?.checkpointCode, 'door-meeting-room')
assert.equal(groupHead?.safetyStationCode, 'meeting-room')
assert.ok(groupHead && groupHead.directionsTh.length > 0)
const meetingRoomDoorPoint = LAB_ACCESS_POINTS.find((point) => point.code === 'door-meeting-room')
assert.ok(meetingRoomDoorPoint?.kind === 'door' && meetingRoomDoorPoint.status === 'open',
  'the group-head route ends at a plain door, not a fingerprint scanner — the door genuinely has none')

// dropdown ของฟอร์มสาธารณะและ constants ของ it-visitor ต้องเสนอปลายทางนี้จริง
const publicForm = readFileSync('components/it-visitor/PublicVisitorForm.tsx', 'utf8')
const itVisitorConstants = readFileSync('lib/it-visitor/constants.ts', 'utf8')
assert.match(publicForm, /GROUP_HEAD_CONTACT_DEPT/, 'the public form dropdown offers the group-head destination')
assert.match(itVisitorConstants, /GROUP_HEAD_CONTACT_DEPT.*from ['"]@\/lib\/lab-map\/visitor['"]/, 'it-visitor re-exports the constant lab-map owns, instead of duplicating the Thai literal')

// ── DTO ผู้มาติดต่อ ──
const visitorMap = buildVisitorLabMapDTO()
assert.ok(visitorMap.structures.length > 0, 'visitors get the same structural geometry')
assert.ok(visitorMap.labels.length > 0, 'visitors get the same authored room labels')
assert.equal(visitorMap.spaces.length, LAB_SPACES.length, 'visitors see the same rooms, not coarse blocks')
assert.deepEqual(
  visitorMap.spaces.map((space) => space.nameTh),
  LAB_SPACES.map((space) => space.nameTh),
  'visitor room names match the staff map exactly',
)
const payload = JSON.stringify(visitorMap)
assert.doesNotMatch(payload, /infectionClass/, 'infection classification is staff-only')
assert.doesNotMatch(payload, /assignmentId|profileId|unassignedPeople/, 'no personnel metadata reaches visitors')

// ── การแก้บั๊กสำคัญของรอบนี้: DTO ผู้มาติดต่อไม่ตัดสถานี/เส้นทางหนีไฟเหลือแค่สำนักงานอีกต่อไป ──
// เดิมกรองเหลือแค่ office ทำให้ผู้มาติดต่อที่ยืนรอที่จุดสแกนอื่นเห็นแผนหนีไฟผิดตำแหน่งเสมอ
assert.equal(visitorMap.stations.length, LAB_STATIONS.length, 'every station reaches the visitor DTO, not just office')
const visitorEvacuationStations = new Set(
  visitorMap.routes.filter((route) => route.kind === 'evacuation').map((route) => route.fromStationCode),
)
assert.ok(visitorEvacuationStations.has('at-blood-bank'), 'evacuation presets for non-office checkpoints reach visitors')
assert.ok(visitorEvacuationStations.has('at-central-lab'), 'evacuation presets for non-office checkpoints reach visitors')
for (const station of LAB_STATIONS) {
  assert.ok(visitorEvacuationStations.has(station.code), `visitor DTO carries evacuation presets for ${station.code}`)
}
// เส้นทางนำทางไปจุดสแกน (kind visitor) ยังจำกัดเฉพาะจากสำนักงานเหมือนเดิม — เป็นจุดลงทะเบียนเดียว
assert.ok(visitorMap.routes.filter((route) => route.kind === 'visitor').every((route) => route.fromStationCode === 'office'))
assert.ok(visitorMap.safetyEquipment.length > 0, 'visitor DTO carries fire safety equipment')
assert.ok(visitorMap.assemblyPoints.length > 0, 'visitor DTO carries assembly points')

// ── บัตรผู้มาติดต่อเปิดป๊อปอัพ ไม่ใช่ลิงก์ออกไปหน้าอื่น ──
const card = readFileSync('components/it-visitor/ActiveVisitCard.tsx', 'utf8')
const dialog = readFileSync('components/lab-map/VisitorMapDialog.tsx', 'utf8')

assert.doesNotMatch(card, /href=|\/lab-map\/office/, 'the card no longer links to a public map route')
assert.doesNotMatch(card, /next\/link/, 'map actions are buttons, not navigation links')
assert.match(card, /setMapDialog\('navigation'\)/)
assert.match(card, /setMapDialog\('safety'\)/)
assert.match(card, /aria-haspopup="dialog"/)
assert.match(card, /<VisitorMapDialog/)
assert.match(card, /safetyStationCode=\{visit\.safetyStationCode\}/, 'the card forwards the visitor\'s real safety station to the dialog')
// การบันทึกออกด้วยตนเองต้องยังอยู่ในบัตรเดิม
assert.match(card, /บันทึกออก/)
assert.match(card, /method: 'PATCH'/)

assert.match(dialog, /role="dialog"/)
assert.match(dialog, /aria-modal="true"/)
assert.match(dialog, /aria-labelledby=/)
assert.match(dialog, /aria-label="ปิดแผนที่"/)
assert.match(dialog, /event\.key === 'Escape'/, 'Escape closes the dialog')
assert.match(dialog, /body\.style\.overflow = 'hidden'/, 'background scrolling is locked')
assert.match(dialog, /openerRef\.current\?\.focus\(\)/, 'focus returns to the triggering button')
assert.match(dialog, /event\.key !== 'Tab'/, 'focus is trapped inside the dialog')
assert.doesNotMatch(dialog, /router\.|useRouter|next\/link/, 'the popup never changes the URL')
assert.match(dialog, /initialSafetyStationCode=/, 'the dialog seeds the safety station from the real checkpoint')
assert.match(dialog, /safetyStationCodes=/, 'the dialog offers switching back to the office plan')

// ── DTO และเส้นทางฝั่งเซิร์ฟเวอร์ต้องพา safetyStationCode ลงมาถึงบัตร ──
const itVisitorTypes = readFileSync('lib/it-visitor/types.ts', 'utf8')
const publicServer = readFileSync('lib/it-visitor/public-server.ts', 'utf8')
assert.match(itVisitorTypes, /safetyStationCode: string/)
assert.match(publicServer, /safetyStationCode: destination\?\.safetyStationCode/)

// ── QR สาธารณะมีไว้เฉพาะป้ายความปลอดภัย ไม่ใช่ทางนำทางผู้มาติดต่อ ──
assert.ok(existsSync('app/(public)/lab-map/[stationCode]/page.tsx'))
assert.doesNotMatch(readFileSync('components/layout/PublicNav.tsx', 'utf8'), /lab-map/)
assert.doesNotMatch(readFileSync('app/(public)/page.tsx', 'utf8'), /lab-map/)

console.log('lab map visitor flow contract passed')
