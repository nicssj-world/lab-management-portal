import assert from 'node:assert/strict'
import {
  EQUIPMENT_AREAS,
  EQUIPMENT_DOORS,
  EQUIPMENT_MAP_VIEW_BOX,
  EQUIPMENT_WALLS,
  areaAndDescendantCodes,
} from '../lib/equipment-map/manifest'
import { validateEquipmentMap } from '../lib/equipment-map/validate'

assert.deepEqual(validateEquipmentMap(), [])
assert.equal(new Set(EQUIPMENT_AREAS.map((area) => area.code)).size, EQUIPMENT_AREAS.length)

const byCode = new Map(EQUIPMENT_AREAS.map((area) => [area.code, area]))
const manifestRuntime = require('../lib/equipment-map/manifest') as { EQUIPMENT_WORK_GROUPS?: readonly { code: string; nameTh: string; areaCodes: readonly string[]; containerAreaCodes?: readonly string[]; summaryAreaCode?: string }[] }
assert.ok(manifestRuntime.EQUIPMENT_WORK_GROUPS, 'the manifest must define work groups separately from geometric parentCode relationships')
const workGroups = manifestRuntime.EQUIPMENT_WORK_GROUPS!
const rect = (code: string) => {
  const area = byCode.get(code)
  assert.ok(area, `equipment area ${code} must exist`)
  return area!.rect
}

// ── ผังนี้ต้องไม่ผูกกับแผนที่ความปลอดภัยอีกต่อไป ──
// เดิมทั้งไฟล์ derive รูปทรงจาก LAB_SPACES ซึ่งเป็นคนละแบบ ทำให้ห้องแสดงผิดตำแหน่งทั้งผัง
const manifestSource = require('node:fs').readFileSync('lib/equipment-map/manifest.ts', 'utf8') as string
assert.doesNotMatch(
  manifestSource,
  /^\s*import[^\n]*['"]@\/lib\/lab-map/m,
  'the equipment map manifest must not import lab-map geometry — the two drawings are different floor plans',
)
assert.match(manifestSource, /\.pptx/, 'the manifest must record which source drawing its coordinates came from')

// ── ทุกป้ายชื่องานในผังต้นฉบับต้องมีพื้นที่รองรับครบ ──
const DRAWING_LABELS: ReadonlyArray<[string, string]> = [
  ['zone-central-chem-immuno', 'เคมีคลินิก+ภูมิคุ้มกัน'],
  ['zone-central-microscopy', 'จุลทรรศนศาสตร์'],
  ['zone-central-hematology', 'โลหิตวิทยา'],
  ['zone-microbiology-main', 'จุลชีววิทยา'],
  ['zone-molecular-genomics', 'งานอณูชีววิทยา'],
  ['zone-clinical-immunology', 'ภูมิคุ้มกัน'],
  ['zone-cold-storage', 'ตู้เย็น'],
  ['zone-material-reagent-store', 'คลังน้ำยา'],
  ['zone-equipment-wash', 'ห้องล้าง'],
  ['zone-special-testing', 'งาน OUTLAB'],
  ['zone-blood-bank', 'คลังเลือด'],
]
for (const [code, nameTh] of DRAWING_LABELS) {
  assert.equal(byCode.get(code)?.nameTh, nameTh, `${code} must keep the drawing's Thai label`)
}

// ── ชื่อพื้นที่และกลุ่มงานสำหรับการเดินตรวจ PM/CAL ──
// กลุ่มงานเป็น taxonomy สำหรับผู้ใช้ ไม่ใช่ parentCode ทางเรขาคณิต: บางงานรวมโถง/ห้องที่ไม่ติดกันบนผัง.
const WORK_AREA_NAMES: ReadonlyArray<[string, string]> = [
  ['zone-molecular-1', 'อณูชีววิทยา'],
  ['zone-molecular-2', 'Extraction Room'],
  ['zone-molecular-3', 'Library Room'],
  ['zone-molecular-4', 'Sequence Room'],
  ['zone-special-testing', 'งาน OUTLAB'],
  ['zone-special-testing-upper-1', 'OUTLAB (โซน 1)'],
  ['zone-special-testing-upper-2', 'OUTLAB (โซน 2)'],
  ['zone-special-testing-lower', 'คลังเลือด (crossmatch)'],
  ['zone-special-testing-mid', 'คลังเลือด (แยกส่วนประกอบ)'],
  ['room-nw-corner', 'โซนห้องน้ำ ห้องอาบน้ำ'],
  ['room-nw-store', 'ห้องนอนเจ้าหน้าที่'],
  ['room-centre-upper', 'ห้องกลางด้านบน 1'],
  ['room-centre-upper-2', 'ห้องกลางด้านบน 2'],
  ['room-se-1', 'ห้องตะวันออกเฉียงใต้ 1'],
  ['room-se-2', 'ห้องตะวันออกเฉียงใต้ 2'],
  ['room-microbiology', 'งานจุลชีววิทยา'],
  ['room-microbiology-ne', 'มุมขวาบนจุลชีววิทยา'],
  ['room-north-corridor-1', 'โถง 1'],
  ['room-north-corridor-2', 'โถง 2'],
  ['room-north-corridor-3', 'โถง 3'],
  ['room-north-small', 'ห้องน้ำ'],
]
for (const [code, nameTh] of WORK_AREA_NAMES) {
  assert.equal(byCode.get(code)?.nameTh, nameTh, `${code} must use the agreed PM/CAL work-area name`)
}

assert.deepEqual(
  workGroups.map((group) => [group.code, group.nameTh, [...group.areaCodes], group.summaryAreaCode ?? null]),
  [
    ['molecular', 'งานอณูชีววิทยา', ['zone-molecular-genomics', 'zone-molecular-1', 'zone-molecular-2', 'zone-molecular-3', 'zone-molecular-4'], 'zone-molecular-genomics'],
    ['central-lab', 'ห้องปฏิบัติการกลาง', ['room-central-lab', 'zone-central-chem-immuno', 'zone-central-microscopy', 'zone-central-hematology'], 'room-central-lab'],
    ['outlab', 'งาน OUTLAB', ['zone-special-testing-upper-1', 'zone-special-testing-upper-2'], null],
    ['blood-bank', 'งานคลังเลือด', ['zone-blood-bank', 'zone-special-testing-lower', 'zone-special-testing-mid', 'room-se-1', 'room-se-2'], null],
    ['microbiology', 'งานจุลชีววิทยา', ['room-microbiology', 'zone-microbiology-main', 'room-microbiology-ne', 'room-north-lab-1', 'room-north-lab-2', 'room-north-lab-3', 'room-north-corridor-1', 'room-north-corridor-2', 'room-north-corridor-3', 'room-north-small'], 'room-microbiology'],
  ],
  'the agreed work groups and their inspection areas must be explicit and ordered',
)
assert.deepEqual(
  workGroups.find((group) => group.code === 'outlab')?.containerAreaCodes,
  ['zone-special-testing'],
  'the former special-testing room is the OUTLAB map container, not a standalone inspection area',
)
assert.ok(!workGroups.some((group) => group.areaCodes.includes('room-fume-hood')), 'electrical/fume-hood utility spaces must not be assigned to a laboratory work group')
assert.ok(!workGroups.some((group) => group.areaCodes.includes('room-server')), 'Server room must not be assigned to a laboratory work group')

// ── viewBox ต้องครอบผังได้พอดี ──
const [, , viewWidth, viewHeight] = EQUIPMENT_MAP_VIEW_BOX.split(' ').map(Number)
const maxX = Math.max(...EQUIPMENT_AREAS.map((a) => a.rect.x + a.rect.width))
const maxY = Math.max(...EQUIPMENT_AREAS.map((a) => a.rect.y + a.rect.height))
assert.ok(maxX <= viewWidth, `areas overflow the view box width (${maxX} > ${viewWidth})`)
assert.ok(maxY <= viewHeight, `areas overflow the view box height (${maxY} > ${viewHeight})`)
assert.ok(viewWidth - maxX < 40, 'view box should hug the drawing width, not leave a wide empty margin')
assert.ok(viewHeight - maxY < 40, 'view box should hug the drawing height, not leave a tall empty margin')

// ── ห้องปฏิบัติการกลาง ต้องถูกซอยเป็น 3 โซนเรียงซ้าย→ขวา เต็มความกว้างพอดี ──
const centralLab = rect('room-central-lab')
const chem = rect('zone-central-chem-immuno')
const micro = rect('zone-central-microscopy')
const hema = rect('zone-central-hematology')
assert.equal(chem.x, centralLab.x)
assert.equal(chem.x + chem.width, micro.x)
assert.equal(micro.x + micro.width, hema.x)
assert.equal(hema.x + hema.width, centralLab.x + centralLab.width)
for (const zone of [chem, micro, hema]) {
  assert.equal(zone.y, centralLab.y)
  assert.equal(zone.height, centralLab.height)
}

// ── ตรวจพิเศษและตรวจต่อ ต้องถูกซอยเป็น 4 โซนเรียงบน→ล่าง เต็มความสูงพอดี (โซนบนแบ่งครึ่งตามที่ผู้ใช้ระบุ) ──
const special = rect('zone-special-testing')
const upper1 = rect('zone-special-testing-upper-1')
const upper2 = rect('zone-special-testing-upper-2')
const mid = rect('zone-special-testing-mid')
const lower = rect('zone-special-testing-lower')
assert.equal(upper1.y, special.y)
assert.equal(upper1.y + upper1.height, upper2.y)
assert.equal(upper2.y + upper2.height, mid.y)
assert.equal(mid.y + mid.height, lower.y)
assert.equal(lower.y + lower.height, special.y + special.height)
for (const zone of [upper1, upper2, mid, lower]) {
  assert.equal(zone.x, special.x)
  assert.equal(zone.width, special.width)
}

// ── อณูชีววิทยา ต้องถูกซอยเป็น 4 โซนซ้าย→ขวา เต็มความกว้างพอดี โซนขวาสุดต้องใหญ่ที่สุด (ตามที่ผู้ใช้ระบุ) ──
const molecular = rect('zone-molecular-genomics')
const mol1 = rect('zone-molecular-1')
const mol2 = rect('zone-molecular-2')
const mol3 = rect('zone-molecular-3')
const mol4 = rect('zone-molecular-4')
assert.equal(mol1.x, molecular.x)
assert.equal(mol1.x + mol1.width, mol2.x)
assert.equal(mol2.x + mol2.width, mol3.x)
assert.equal(mol3.x + mol3.width, mol4.x)
assert.equal(mol4.x + mol4.width, molecular.x + molecular.width)
for (const zone of [mol1, mol2, mol3, mol4]) {
  assert.equal(zone.y, molecular.y)
  assert.equal(zone.height, molecular.height)
}
assert.ok(mol4.width > mol1.width && mol4.width > mol2.width && mol4.width > mol3.width, 'zone-molecular-4 (rightmost) must be the widest of the four zones')

// ── โถงทิศเหนือต้องเป็น 3 ห้องเรียงติดกัน ไม่ใช่ห้องเดียวยาว ──
const corridor1 = rect('room-north-corridor-1')
const corridor2 = rect('room-north-corridor-2')
const corridor3 = rect('room-north-corridor-3')
assert.equal(corridor1.x + corridor1.width, corridor2.x)
assert.equal(corridor2.x + corridor2.width, corridor3.x)

// ── จุลชีววิทยา ต้องมีคลังน้ำยาเป็นโซนลูก ต่อกับโซนหลักพอดี ไม่ทับโถงทิศเหนือ/คลังเลือด ──
const microbiology = rect('room-microbiology')
const microbiologyMain = rect('zone-microbiology-main')
const reagentStore = rect('zone-material-reagent-store')
assert.equal(microbiologyMain.y, microbiology.y)
assert.equal(reagentStore.y + reagentStore.height, microbiology.y + microbiology.height)
assert.equal(microbiologyMain.x, microbiology.x)
assert.equal(reagentStore.x, microbiology.x)
assert.equal(microbiologyMain.width, microbiology.width)
assert.equal(reagentStore.width, microbiology.width)
assert.equal(microbiology.y, 205, 'the microbiology zone must begin below the corridor, not include it')
assert.equal(rect('room-microbiology-ne').y, corridor2.y + corridor2.height, 'the missing north-east room must sit beside the corridor')
assert.equal(rect('room-microbiology-ne').x, 1197)
assert.equal(rect('room-microbiology-ne').x + rect('room-microbiology-ne').width, microbiology.x + microbiology.width)
assert.deepEqual(byCode.get('zone-microbiology-main')?.polygon, [
  { x: 936, y: 205 }, { x: 1370, y: 205 }, { x: 1370, y: 340 },
  { x: 1058, y: 340 }, { x: 1058, y: 278 }, { x: 936, y: 278 },
])
assert.deepEqual(byCode.get('zone-material-reagent-store')?.polygon, [
  { x: 936, y: 278 }, { x: 1058, y: 278 }, { x: 1058, y: 340 },
  { x: 1370, y: 340 }, { x: 1370, y: 409 }, { x: 936, y: 409 },
])

// ── ห้องกลางด้านบนแบ่งเป็น 2 ห้องตามผนังในภาพอ้างอิง และความกว้างรวมต้องเท่าเดิม ──
const centreUpper1 = rect('room-centre-upper')
const centreUpper2 = rect('room-centre-upper-2')
const coldStorage = rect('zone-cold-storage')
assert.equal(centreUpper1.x, coldStorage.x)
assert.equal(centreUpper1.x + centreUpper1.width, centreUpper2.x)
assert.equal(centreUpper2.x + centreUpper2.width, coldStorage.x + coldStorage.width)
assert.equal(centreUpper1.width, 74)
assert.equal(centreUpper2.width, 90)
assert.equal(centreUpper1.y, centreUpper2.y)
assert.equal(centreUpper1.height, centreUpper2.height)
assert.equal(centreUpper1.width + centreUpper2.width, special.width)
assert.equal(coldStorage.width, special.width)

// ── ห้องล้างต้องรวมพื้นที่สีเทาด้านล่างซ้ายและด้านขวา โดยไม่กินห้องข้างเคียง ──
assert.deepEqual(byCode.get('zone-equipment-wash')?.polygon, [
  { x: 283, y: 184 }, { x: 516, y: 184 }, { x: 516, y: 350 }, { x: 654, y: 350 },
  { x: 654, y: 400 }, { x: 470, y: 400 }, { x: 470, y: 470 }, { x: 283, y: 470 },
])

// ── การกรองตามห้องต้องรวมโซนลูกด้วย ──
assert.deepEqual(
  areaAndDescendantCodes('room-central-lab').sort(),
  ['room-central-lab', 'zone-central-chem-immuno', 'zone-central-hematology', 'zone-central-microscopy'].sort(),
)
assert.deepEqual(
  areaAndDescendantCodes('zone-molecular-genomics').sort(),
  ['zone-molecular-genomics', 'zone-molecular-1', 'zone-molecular-2', 'zone-molecular-3', 'zone-molecular-4'].sort(),
)
assert.deepEqual(
  areaAndDescendantCodes('room-microbiology').sort(),
  ['room-microbiology', 'zone-microbiology-main', 'zone-material-reagent-store'].sort(),
)
assert.deepEqual(areaAndDescendantCodes('zone-blood-bank'), ['zone-blood-bank'])

// ── ผนังเดี่ยวจากผังต้นฉบับต้องยังอยู่ครบ และเป็น path แบบ absolute ──
assert.equal(EQUIPMENT_WALLS.length, 18, 'the marked corridor divider line must be removed completely')
assert.ok(!EQUIPMENT_WALLS.some((wall) => wall.code === 'wall-10'), 'the excess cold-storage line must stay removed')
assert.ok(!EQUIPMENT_WALLS.some((wall) => wall.code === 'wall-6'), 'the marked vertical excess line beside the reagent store must be removed')
assert.equal(EQUIPMENT_WALLS.find((wall) => wall.code === 'wall-microbiology-inner')?.d, 'M 936 205 H 1370')
assert.ok(!EQUIPMENT_WALLS.some((wall) => wall.code === 'wall-microbiology-corridor-north'), 'no fragment of the marked horizontal line may remain')
assert.equal(EQUIPMENT_WALLS.find((wall) => wall.code === 'wall-microbiology-corridor-west')?.d, 'M 936 151 V 205')
for (const item of EQUIPMENT_WALLS) {
  assert.match(item.d, /^M [\d.]+ [\d.]+ [HVL]/, `wall ${item.code} must be an absolute M/H/V/L path`)
}

// ── ป้ายและสีที่ผู้ใช้กำหนด ──
assert.equal(byCode.get('zone-molecular-genomics')?.label, undefined, 'the molecular biology label must not be drawn')
assert.equal(byCode.get('room-central-lab')?.label, undefined, 'the central-lab label must not be drawn')
for (const code of ['zone-special-testing-mid', 'zone-special-testing-lower', 'room-se-1', 'zone-blood-bank']) {
  assert.equal(byCode.get(code)?.fillTone, 'controlled', `${code} must use the shared controlled-zone colour`)
}
assert.equal(EQUIPMENT_DOORS.length, 44, 'the requested corridor doors must be included')
assert.deepEqual(
  EQUIPMENT_DOORS.find((door) => door.code === 'door-h-18'),
  { code: 'door-h-18', x: 915, y: 409, orientation: 'horizontal', length: 35 },
  'the corridor door between special-testing upper zone 1 and the reagent store must be centred on its wall',
)
assert.ok(!EQUIPMENT_DOORS.some((door) => door.code === 'door-v-2'), 'the marked vertical door inside molecular zone 1 must not be rendered')
assert.ok(EQUIPMENT_DOORS.every((door) => door.length > 0), 'every reference door must have a measured length')
assert.deepEqual(
  EQUIPMENT_DOORS.find((door) => door.code === 'door-h-10'),
  { code: 'door-h-10', x: 75, y: 185, orientation: 'horizontal', length: 35 },
  'the door above molecular zone 2 must be centred on the zone',
)
assert.deepEqual(
  EQUIPMENT_DOORS.find((door) => door.code === 'door-h-24'),
  { code: 'door-h-24', x: 25, y: 185, orientation: 'horizontal', length: 35 },
  'the new door above molecular zone 1 must be centred on the zone',
)
assert.equal(EQUIPMENT_DOORS.find((door) => door.code === 'door-h-21')?.y, 455, 'the door below special-testing upper zone 1 must sit exactly on its wall')
for (const code of ['door-h-10', 'door-h-13', 'door-h-14']) {
  assert.equal(EQUIPMENT_DOORS.find((door) => door.code === code)?.y, 185, `${code} must sit exactly on the molecular-zone north wall`)
}
assert.deepEqual(
  EQUIPMENT_DOORS.find((door) => door.code === 'door-h-12'),
  { code: 'door-h-12', x: 757, y: 185, orientation: 'horizontal', length: 35 },
  'the left door above the centre-upper room must sit exactly on its north wall',
)
assert.deepEqual(
  EQUIPMENT_DOORS.find((door) => door.code === 'door-h-15'),
  { code: 'door-h-15', x: 861, y: 185, orientation: 'horizontal', length: 35 },
  'the right door above the centre-upper room must not cross the room corner',
)
assert.deepEqual(
  EQUIPMENT_DOORS.find((door) => door.code === 'door-v-21'),
  { code: 'door-v-21', x: 1370, y: 133, orientation: 'vertical', length: 35 },
  'the east door must be centred on the corridor below north laboratory 3',
)

const zones = EQUIPMENT_AREAS.filter((a) => a.kind === 'zone')
const rooms = EQUIPMENT_AREAS.filter((a) => a.kind === 'room')
console.log(`equipment-map-domain: ${rooms.length} rooms + ${zones.length} zones, all checks passed`)
