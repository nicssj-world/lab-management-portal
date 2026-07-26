import type { DEPARTMENTS } from '@/lib/validations/user-schema'
import type {
  LabAccessPointDefinition,
  LabLabelDefinition,
  LabRoutePreset,
  LabSpaceDefinition,
  LabStationDefinition,
  LabStructureDefinition,
  LabZoneDefinition,
  RoutePresetLookup,
  SvgShape,
} from './types'

type WorkUnit = (typeof DEPARTMENTS)[number]

/**
 * ผังชั้น 3 สร้างใหม่ทั้งหมดจากแบบต้นฉบับ `Screenshot 2026-07-26 092955.png`
 * ระบบพิกัดเดียวกันทุกผู้ใช้งาน: เจ้าหน้าที่ ผู้มาติดต่อ แผนที่หนีไฟ และงานพิมพ์
 */
export const LAB_MAP_VERSION = 'F3-2026.07.26-04'
export const LAB_MAP_VIEW_BOX = '0 0 1477 892'

const rect = (x: number, y: number, width: number, height: number): SvgShape => ({
  type: 'rect',
  x,
  y,
  width,
  height,
})

const OFFICE: WorkUnit = 'สำนักงานกลุ่มงานเทคนิคการแพทย์'
const CHEMISTRY: WorkUnit = 'งานเคมีคลินิก'
const HEMATOLOGY: WorkUnit = 'งานโลหิตวิทยาคลินิก'
const IMMUNOLOGY: WorkUnit = 'งานภูมิคุ้มกันวิทยาคลินิก'
const MICROSCOPY: WorkUnit = 'งานจุลทรรศนศาสตร์คลินิก'
const MOLECULAR: WorkUnit = 'งานอณูชีววิทยา'
const MICROBIOLOGY: WorkUnit = 'งานจุลชีววิทยา'
const BLOOD_BANK: WorkUnit = 'งานคลังเลือด'
const SPECIAL_TESTING: WorkUnit = 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ'

interface SpaceInput {
  code: string
  nameTh: string
  nameEn?: string
  shape: SvgShape
  infectionClass: LabSpaceDefinition['infectionClass']
  workUnits?: readonly WorkUnit[]
  controlled?: boolean
  nestedIn?: string
}

const space = (input: SpaceInput): LabSpaceDefinition => ({
  code: input.code,
  nameTh: input.nameTh,
  nameEn: input.nameEn,
  shape: input.shape,
  infectionClass: input.infectionClass,
  workUnits: input.workUnits ?? [],
  controlled: input.controlled ?? false,
  nestedIn: input.nestedIn,
})

export const REQUIRED_SPACE_CODES = [
  'office',
  'group-head-office',
  'group-head-restroom',
  'meeting-room',
  'central-lab',
  'clinical-immunology-room',
  'molecular-biology-lab',
  'genomics-lab',
  'microbiology-lab',
  'bsl2-enhance',
  'pcr-room',
  'fungus-room',
  'material-store',
  'material-reagent-store',
  'cold-material-reagent-store',
  'special-testing-lab',
  'blood-donation-room',
  'donor-snack-room',
  'blood-component-room',
  'blood-prep-room',
  'ppe-zone',
  'equipment-wash',
  'chemical-prep',
  'electrical-control',
  'computer-control',
  'stair-room',
  'lift-1',
  'lift-2',
  'lift-3',
  'lift-4',
] as const

/**
 * ห้องซ้อนห้องต้องอยู่ "หลัง" ห้องแม่ในลิสต์ เพื่อให้วาดทับกันถูกลำดับ
 * (โครงสร้างผนังวาดแยกอีกชั้น จึงไม่ต้องสร้างห้องปลอมเพื่อให้เห็นแนวกั้น)
 */
export const LAB_SPACES: readonly LabSpaceDefinition[] = [
  // ── แถบทิศเหนือ ──
  space({ code: 'restroom-northwest-1', nameTh: 'ห้องน้ำ', shape: rect(95, 17, 65, 78), infectionClass: 'clean' }),
  space({ code: 'shower-northwest', nameTh: 'ห้องอาบน้ำ', shape: rect(160, 17, 57, 78), infectionClass: 'clean', workUnits: [OFFICE] }),
  space({ code: 'restroom-northwest-2', nameTh: 'ห้องน้ำ', shape: rect(95, 95, 65, 57), infectionClass: 'clean' }),
  space({ code: 'staff-rest-room', nameTh: 'ห้องพักเวรเจ้าหน้าที่', shape: rect(217, 17, 185, 114), infectionClass: 'clean', workUnits: [OFFICE] }),
  space({
    code: 'central-lab',
    nameTh: 'ห้องปฏิบัติการกลาง',
    nameEn: 'Central Lab',
    shape: rect(402, 17, 645, 114),
    infectionClass: 'infectious',
    workUnits: [CHEMISTRY, IMMUNOLOGY, HEMATOLOGY, MICROSCOPY],
    controlled: true,
  }),
  space({
    code: 'bsl2-enhance',
    nameTh: 'BSL2 Enhance',
    shape: { type: 'polygon', points: [[1047, 17], [1215, 17], [1215, 92], [1180, 92], [1180, 131], [1047, 131]] },
    infectionClass: 'infectious',
    workUnits: [MICROBIOLOGY],
    controlled: true,
  }),
  space({ code: 'restroom-northeast', nameTh: 'ห้องน้ำ', shape: rect(1215, 17, 49, 75), infectionClass: 'clean' }),
  space({ code: 'pcr-room', nameTh: 'ห้อง PCR', shape: rect(1264, 17, 85, 75), infectionClass: 'infectious', workUnits: [MICROBIOLOGY], controlled: true }),
  space({ code: 'fungus-room', nameTh: 'ห้องเชื้อรา', shape: rect(1245, 157, 104, 48), infectionClass: 'infectious', workUnits: [MICROBIOLOGY], controlled: true }),

  // ── ปีกตะวันตก ──
  space({ code: 'genomics-lab', nameTh: 'ห้องปฏิบัติการจีโนมิกส์', shape: rect(44, 203, 190, 88), infectionClass: 'infectious', workUnits: [MOLECULAR], controlled: true }),
  space({ code: 'molecular-biology-lab', nameTh: 'ห้องปฏิบัติการอณูชีววิทยา', shape: rect(234, 203, 121, 88), infectionClass: 'infectious', workUnits: [MOLECULAR], controlled: true }),
  space({ code: 'equipment-wash', nameTh: 'ห้องล้างอุปกรณ์', shape: rect(355, 208, 152, 170), infectionClass: 'infectious' }),
  space({ code: 'ppe-zone', nameTh: 'โซน PPE', shape: rect(503, 173, 105, 35), infectionClass: 'clean' }),
  space({ code: 'clinical-immunology-room', nameTh: 'ห้องปฏิบัติการภูมิคุ้มกันวิทยาคลินิก', shape: rect(543, 208, 150, 62), infectionClass: 'infectious', workUnits: [IMMUNOLOGY], controlled: true }),
  space({ code: 'chemical-prep', nameTh: 'ห้องเตรียมสารเคมี', shape: rect(507, 293, 106, 40), infectionClass: 'risk', workUnits: [CHEMISTRY, IMMUNOLOGY], controlled: true }),
  space({ code: 'electrical-control', nameTh: 'ห้องควบคุมไฟฟ้า', shape: rect(507, 333, 106, 45), infectionClass: 'clean' }),
  space({ code: 'computer-control', nameTh: 'ห้องควบคุมระบบคอมพิวเตอร์', shape: rect(507, 378, 186, 41), infectionClass: 'clean', workUnits: [OFFICE] }),
  space({ code: 'meeting-room', nameTh: 'ห้องประชุม', shape: rect(506, 419, 186, 172), infectionClass: 'clean', workUnits: [OFFICE] }),
  space({ code: 'group-head-office', nameTh: 'ห้องหัวหน้ากลุ่มงานเทคนิคการแพทย์', shape: rect(506, 591, 186, 71), infectionClass: 'clean', workUnits: [OFFICE] }),
  // ห้องน้ำซ้อนอยู่ในห้องหัวหน้ากลุ่มงานจริงตามแบบ — ต้องอยู่หลังห้องแม่
  space({ code: 'group-head-restroom', nameTh: 'ห้องน้ำ', shape: rect(506, 628, 68, 34), infectionClass: 'clean', nestedIn: 'group-head-office' }),
  space({ code: 'south-restroom-2', nameTh: 'ห้องน้ำ', shape: rect(506, 662, 68, 47), infectionClass: 'clean' }),
  space({ code: 'south-restroom-3', nameTh: 'ห้องน้ำ', shape: rect(506, 709, 68, 51), infectionClass: 'clean' }),
  space({ code: 'lift-3', nameTh: 'ลิฟท์ 3', shape: rect(506, 760, 68, 40), infectionClass: 'clean' }),
  space({ code: 'lift-4', nameTh: 'ลิฟท์ 4', shape: rect(506, 800, 68, 40), infectionClass: 'clean' }),

  // ── แกนกลาง ──
  space({ code: 'locker-room', nameTh: 'ห้อง Locker จนท.', shape: rect(802, 205, 104, 101), infectionClass: 'clean', workUnits: [OFFICE] }),
  space({ code: 'microbiology-staff-room', nameTh: 'ห้องพัก จนท. งานจุลชีววิทยา', shape: rect(906, 205, 103, 101), infectionClass: 'clean', workUnits: [MICROBIOLOGY] }),
  space({ code: 'cold-material-reagent-store', nameTh: 'ห้องเก็บวัสดุและน้ำยาแช่เย็น', shape: rect(802, 306, 207, 71), infectionClass: 'clean', workUnits: [MICROBIOLOGY], controlled: true }),
  space({ code: 'special-testing-lab', nameTh: 'ห้องปฏิบัติการตรวจพิเศษ', shape: rect(802, 377, 207, 98), infectionClass: 'infectious', workUnits: [SPECIAL_TESTING], controlled: true }),
  space({ code: 'blood-component-room', nameTh: 'ห้องแยกส่วนประกอบของเลือด', shape: rect(802, 475, 207, 116), infectionClass: 'infectious', workUnits: [BLOOD_BANK], controlled: true }),
  space({ code: 'blood-prep-room', nameTh: 'ห้องเตรียมเลือด', shape: rect(802, 591, 207, 113), infectionClass: 'infectious', workUnits: [BLOOD_BANK], controlled: true }),

  // ── ปีกตะวันออก ──
  // แบบต้นฉบับวาดพื้นที่จุลชีววิทยาเป็นห้องเดียวเต็มบล็อก ไม่มีผนังคั่นภายใน
  space({ code: 'microbiology-lab', nameTh: 'ห้องปฏิบัติการจุลชีววิทยาคลินิก', shape: rect(1057, 205, 290, 172), infectionClass: 'infectious', workUnits: [MICROBIOLOGY], controlled: true }),
  // คลังวัสดุซ้อนอยู่มุมล่างซ้ายของห้อง — ต้องอยู่หลังห้องแม่
  space({ code: 'material-store', nameTh: 'คลังวัสดุ', shape: rect(1057, 322, 83, 55), infectionClass: 'clean', workUnits: [MICROBIOLOGY], controlled: true, nestedIn: 'microbiology-lab' }),
  space({ code: 'material-reagent-store', nameTh: 'คลังวัสดุและน้ำยา', shape: rect(1057, 377, 290, 42), infectionClass: 'clean', workUnits: [MICROBIOLOGY], controlled: true }),
  space({
    code: 'blood-donation-room',
    nameTh: 'ห้องรับบริจาคเลือด งานคลังเลือด',
    // เว้าหลบห้องสำนักงานที่มุมล่างซ้าย ตามแบบต้นฉบับ
    shape: { type: 'polygon', points: [[1057, 419], [1347, 419], [1347, 701], [1094, 701], [1094, 647], [1057, 647]] },
    infectionClass: 'infectious',
    workUnits: [BLOOD_BANK],
    controlled: true,
  }),
  // ห้องอาหารว่างและห้องน้ำผู้บริจาค ซ้อนอยู่ในห้องรับบริจาคเลือดทั้งหมด
  space({ code: 'donor-snack-room', nameTh: 'ห้องอาหารว่างสำหรับผู้บริจาคเลือด', shape: rect(1160, 582, 122, 117), infectionClass: 'clean', workUnits: [BLOOD_BANK], nestedIn: 'blood-donation-room' }),
  space({ code: 'donor-restroom-1', nameTh: 'ห้องน้ำ', shape: rect(1282, 582, 65, 33), infectionClass: 'clean', nestedIn: 'blood-donation-room' }),
  space({ code: 'donor-restroom-2', nameTh: 'ห้องน้ำ', shape: rect(1282, 615, 65, 32), infectionClass: 'clean', nestedIn: 'blood-donation-room' }),
  space({ code: 'office', nameTh: 'สำนักงานกลุ่มงานเทคนิคการแพทย์', shape: rect(1009, 647, 85, 54), infectionClass: 'clean', workUnits: [OFFICE] }),

  // ── แถบทิศใต้ ──
  space({ code: 'stair-room', nameTh: 'ห้องบันได', shape: rect(855, 760, 67, 80), infectionClass: 'clean' }),
  space({ code: 'lift-2', nameTh: 'ลิฟท์ 2', shape: rect(922, 760, 38, 80), infectionClass: 'clean' }),
  space({ code: 'lift-1', nameTh: 'ลิฟท์ 1', shape: rect(960, 760, 39, 80), infectionClass: 'clean' }),
  space({ code: 'staff-waiting-area', nameTh: 'บริเวณที่พักเจ้าหน้าที่', shape: rect(999, 775, 130, 84), infectionClass: 'clean', workUnits: [OFFICE] }),
  space({ code: 'supplies-equipment-store', nameTh: 'ห้องเก็บพัสดุและอุปกรณ์', shape: rect(1129, 762, 220, 78), infectionClass: 'clean', workUnits: [OFFICE] }),
]

const structure = (code: string, kind: LabStructureDefinition['kind'], d: string): LabStructureDefinition => ({ code, kind, d })

export const LAB_STRUCTURES: readonly LabStructureDefinition[] = [
  // ── ผนังภายนอก ──
  structure('wall-north', 'exterior-wall', 'M 95 17 H 1349'),
  structure('wall-east-north', 'exterior-wall', 'M 1349 17 V 92'),
  structure('exit-3b-stub', 'exterior-wall', 'M 1349 92 H 1407 V 157 H 1349'),
  structure('wall-east', 'exterior-wall', 'M 1349 157 V 704'),
  structure('exit-3c-stub', 'exterior-wall', 'M 1349 704 H 1407 V 762 H 1349'),
  structure('wall-east-south', 'exterior-wall', 'M 1349 762 V 840'),
  structure('wall-south-east', 'exterior-wall', 'M 1349 840 H 1129 V 859 H 999 V 840 H 855'),
  structure('wall-south-west', 'exterior-wall', 'M 855 840 H 506'),
  structure('wall-west-south', 'exterior-wall', 'M 506 840 V 591'),
  structure('wall-northwest', 'exterior-wall', 'M 95 17 V 152 H 160'),
  structure('wall-west-molecular', 'exterior-wall', 'M 44 203 V 291 H 355'),

  // ── ผนังภายใน แถบทิศเหนือ ──
  structure('wall-restroom-nw-row', 'wall', 'M 95 95 H 217'),
  structure('wall-restroom-nw-split', 'wall', 'M 160 17 V 95'),
  structure('wall-restroom-nw-2-east', 'wall', 'M 160 95 V 152'),
  structure('wall-staff-rest-west', 'wall', 'M 217 17 V 131'),
  structure('wall-central-lab-west', 'wall', 'M 402 17 V 131'),
  // ผนังใต้บล็อกทิศเหนือ เว้นช่องประตูห้องปฏิบัติการกลางสองบาน
  structure('wall-north-block-south-a', 'wall', 'M 217 131 H 932'),
  structure('wall-north-block-south-b', 'wall', 'M 1010 131 H 1047'),
  structure('wall-central-lab-east', 'wall', 'M 1047 17 V 131'),
  structure('wall-bsl2-south', 'wall', 'M 1047 131 H 1180 V 92 H 1349'),
  structure('wall-restroom-ne-west', 'wall', 'M 1215 17 V 92'),
  structure('wall-pcr-west', 'wall', 'M 1264 17 V 92'),
  structure('wall-fungus-room', 'wall', 'M 1245 157 H 1349 M 1245 157 V 205 H 1349'),
  structure('wall-exit-3a-jamb', 'wall', 'M 148 152 V 203'),

  // ── ผนังภายใน ปีกตะวันตก ──
  structure('wall-genomics-east', 'wall', 'M 234 203 V 291'),
  structure('wall-molecular-block-north', 'wall', 'M 44 203 H 355'),
  structure('wall-equipment-wash-west', 'wall', 'M 355 208 V 378'),
  structure('wall-equipment-wash-south', 'wall', 'M 355 378 H 693'),
  // เดิมมีปลายผนังลอย 'M 455 208 V 263' ไม่เชื่อมกับห้องหรือธรณีประตูใด ๆ — ตัดออก (ไม่ใช่ผนังจริง)
  structure('wall-equipment-wash-north', 'wall', 'M 453 208 H 543'),
  structure('wall-ppe-zone', 'wall', 'M 503 173 H 608 V 208 H 503 V 173'),
  structure('wall-clinical-immunology', 'wall', 'M 543 208 V 270 H 693 M 543 208 H 693'),
  structure('wall-clinical-immunology-east', 'wall', 'M 693 270 V 333'),
  structure('wall-chemical-prep', 'wall', 'M 507 293 H 613 V 378 H 507 V 293 M 507 333 H 613'),
  // ประตูล็อคถาวรอยู่บนผนังนี้ — สัญลักษณ์กุญแจผูกกับบานประตู ไม่ใช่ตัวห้องควบคุมไฟฟ้า
  structure('wall-locked-door-jambs', 'wall', 'M 613 333 H 624 M 642 333 H 693'),
  structure('wall-computer-control', 'wall', 'M 507 378 H 693 V 419 H 507'),
  structure('wall-meeting-room', 'wall', 'M 506 419 H 692 V 591 H 506'),
  structure('wall-group-head-office', 'wall', 'M 506 591 H 692 V 662 H 506'),
  structure('wall-group-head-restroom', 'wall', 'M 506 628 H 574 V 662'),
  structure('wall-south-restrooms', 'wall', 'M 506 709 H 574 M 506 760 H 574 M 506 800 H 574 M 574 628 V 840'),
  structure('wall-south-corridor-north', 'wall', 'M 574 760 H 660 M 780 760 H 855'),
  structure('wall-stair-room', 'wall', 'M 855 760 H 998 M 855 760 V 840 M 922 760 V 840 M 960 760 V 840 M 855 790 H 922'),
  structure('wall-staff-waiting', 'wall', 'M 999 762 V 859 M 1129 762 V 859 M 999 775 H 1129'),
  structure('wall-supplies-store', 'wall', 'M 1129 762 H 1349'),

  // ── ผนังภายใน แกนกลาง ──
  structure('wall-centre-block', 'wall', 'M 802 205 H 1009 V 591 M 802 205 V 704 M 802 704 H 1009'),
  structure('wall-centre-block-east-south', 'wall', 'M 1009 591 V 704'),
  structure('wall-centre-dividers', 'wall', 'M 906 205 V 306 M 802 306 H 1009 M 802 377 H 1009 M 802 475 H 1009 M 802 591 H 1009'),

  // ── ผนังภายใน ปีกตะวันออก ──
  structure('wall-east-block-north', 'wall', 'M 1057 205 H 1349'),
  structure('wall-east-block-west', 'wall', 'M 1057 205 V 617'),
  structure('wall-east-block-dividers', 'wall', 'M 1057 377 H 1349 M 1057 419 H 1349'),
  structure('wall-material-store', 'wall', 'M 1057 322 H 1140 V 377'),
  structure('wall-donor-snack-room', 'wall', 'M 1160 582 H 1240 M 1160 582 V 701 M 1160 699 H 1282'),
  structure('wall-donor-restrooms', 'wall', 'M 1282 582 H 1347 V 647 H 1282 V 582 M 1282 615 H 1347'),
  structure('wall-office', 'wall', 'M 1009 647 H 1094 V 701 H 1009'),
  structure('wall-blood-block-south', 'wall', 'M 1094 701 H 1097 M 1160 701 H 1349'),

  // ── ประตูและบานสวิง ──
  structure('door-central-lab-west', 'door-swing', 'M 932 131 A 38 38 0 0 1 970 93'),
  structure('door-central-lab-west-leaf', 'door-leaf', 'M 970 131 V 93'),
  structure('door-central-lab-east', 'door-swing', 'M 1010 131 A 38 38 0 0 0 972 93'),
  structure('door-central-lab-east-leaf', 'door-leaf', 'M 972 131 V 93'),
  structure('door-equipment-wash', 'door-swing', 'M 355 208 A 55 55 0 0 1 410 263'),
  structure('door-equipment-wash-leaf', 'door-leaf', 'M 410 208 V 263'),
  structure('door-group-head-office', 'door-swing', 'M 692 662 A 50 50 0 0 0 742 612'),
  structure('door-group-head-office-leaf', 'door-leaf', 'M 742 612 V 662'),
  // ห้องประชุมไม่มีประตูมาก่อน (ตรวจพบว่าผนังปิดทึบทั้งสี่ด้าน) — เพิ่มทางเข้าที่ผนังฝั่งตะวันออก
  // เชื่อมกับโถงกลาง (x=750) แต่ตั้งใจให้บานสวิงเข้าไปในห้องประชุมเอง (ตามภาพอ้างอิงที่ผู้ใช้ส่งมา)
  // ไม่ใช่สวิงออกไปในโถงกลางแบบประตูห้องหัวหน้ากลุ่มงานฯ ข้างบน — จุดหมุนอยู่ที่ (692,550)
  structure('door-meeting-room', 'door-swing', 'M 692 500 A 50 50 0 0 0 642 550'),
  structure('door-meeting-room-leaf', 'door-leaf', 'M 692 550 H 642'),
  structure('door-cold-store', 'door-swing', 'M 1009 322 A 55 55 0 0 1 1056 377'),
  structure('door-office', 'door-swing', 'M 1094 661 A 47 47 0 0 0 1141 701'),
  structure('door-office-leaf', 'door-leaf', 'M 1094 661 V 647'),

  // ── ธรณีประตู / ช่องเปิด (เส้นประที่ไม่ใช่จุดควบคุม) ──
  structure('threshold-equipment-wash', 'threshold', 'M 358 208 H 453'),
  structure('threshold-group-head', 'threshold', 'M 692 662 H 742 M 747 662 H 794'),
  structure('threshold-blood-prep', 'threshold', 'M 794 598 V 662'),
  structure('threshold-cold-store', 'threshold', 'M 1009 377 H 1056'),
  structure('threshold-office-east', 'threshold', 'M 1097 701 H 1159'),
  structure('threshold-blood-donation-west', 'threshold', 'M 1057 617 V 647'),

  // ── แนวกั้นจุดสแกน (Scanner control barrier) ──
  structure('barrier-molecular-ppe', 'scanner-barrier', 'M 617 131 V 208'),
  structure('barrier-microbiology', 'scanner-barrier', 'M 1057 131 V 205'),
  structure('barrier-special-testing', 'scanner-barrier', 'M 796 377 V 475'),
]

const label = (
  code: string,
  spaceCode: string | undefined,
  x: number,
  y: number,
  lines: readonly string[],
  fontSize: number,
  extra: Partial<Pick<LabLabelDefinition, 'rotate' | 'emphasis'>> = {},
): LabLabelDefinition => ({ code, spaceCode, x, y, lines, fontSize, ...extra })

/**
 * ป้ายชื่อทั้งหมดเขียนไว้ตรง ๆ พร้อมจุดยึด การขึ้นบรรทัด ขนาด และการหมุน
 * ไม่มีการตัดคำอัตโนมัติ จึงไม่มีคำหาย คำซ้ำ หรือถูกตัดทิ้งที่บรรทัดที่สาม
 */
export const LAB_LABELS: readonly LabLabelDefinition[] = [
  label('label-restroom-northwest-1', 'restroom-northwest-1', 127, 60, ['ห้องน้ำ'], 12),
  label('label-shower-northwest', 'shower-northwest', 188, 50, ['ห้อง', 'อาบน้ำ'], 10),
  label('label-restroom-northwest-2', 'restroom-northwest-2', 127, 128, ['ห้องน้ำ'], 12),
  label('label-staff-rest-room', 'staff-rest-room', 309, 68, ['ห้องพักเวรเจ้าหน้าที่'], 16),
  label('label-central-lab', 'central-lab', 724, 74, ['ห้องปฏิบัติการกลาง (Central Lab)'], 18),
  label('label-bsl2-enhance', 'bsl2-enhance', 1113, 55, ['BSL2', 'Enhance'], 15),
  label('label-restroom-northeast', 'restroom-northeast', 1239, 55, ['ห้องน้ำ'], 9, { rotate: -90 }),
  label('label-pcr-room', 'pcr-room', 1306, 58, ['ห้อง PCR'], 13),
  label('label-fungus-room', 'fungus-room', 1297, 185, ['ห้องเชื้อรา'], 13),
  label('label-genomics-lab', 'genomics-lab', 139, 252, ['ห้องปฏิบัติการจีโนมิกส์'], 16),
  label('label-molecular-biology-lab', 'molecular-biology-lab', 294, 240, ['ห้องปฏิบัติการ', 'อณูชีววิทยา'], 14),
  label('label-equipment-wash', 'equipment-wash', 430, 328, ['ห้องล้าง', 'อุปกรณ์'], 13),
  label('label-ppe-zone', 'ppe-zone', 555, 196, ['โซน PPE'], 12),
  label('label-clinical-immunology-room', 'clinical-immunology-room', 618, 234, ['ห้องปฏิบัติการ', 'ภูมิคุ้มกันวิทยาคลินิก'], 13),
  label('label-chemical-prep', 'chemical-prep', 560, 318, ['ห้องเตรียมสารเคมี'], 11),
  label('label-electrical-control', 'electrical-control', 560, 360, ['ห้องควบคุมไฟฟ้า'], 11),
  label('label-computer-control', 'computer-control', 600, 403, ['ห้องควบคุมระบบคอมพิวเตอร์'], 12),
  label('label-meeting-room', 'meeting-room', 599, 512, ['ห้องประชุม'], 17),
  label('label-group-head-office', 'group-head-office', 615, 610, ['ห้องหัวหน้ากลุ่มงาน', 'เทคนิคการแพทย์'], 12),
  label('label-group-head-restroom', 'group-head-restroom', 540, 649, ['ห้องน้ำ'], 10),
  label('label-south-restroom-2', 'south-restroom-2', 540, 690, ['ห้องน้ำ'], 10),
  label('label-south-restroom-3', 'south-restroom-3', 540, 740, ['ห้องน้ำ'], 10),
  label('label-lift-3', 'lift-3', 540, 784, ['ลิฟท์ 3'], 10),
  label('label-lift-4', 'lift-4', 540, 824, ['ลิฟท์ 4'], 10),
  label('label-locker-room', 'locker-room', 854, 238, ['ห้อง', 'Locker', 'จนท.'], 13),
  label('label-microbiology-staff-room', 'microbiology-staff-room', 957, 236, ['ห้อง', 'พักจนท.', 'งานจุลชีวฯ'], 11),
  label('label-cold-material-reagent-store', 'cold-material-reagent-store', 905, 335, ['ห้องเก็บวัสดุ', 'และน้ำยาแช่เย็น'], 13),
  label('label-special-testing-lab', 'special-testing-lab', 905, 431, ['ห้องปฏิบัติการตรวจพิเศษ'], 14),
  label('label-blood-component-room', 'blood-component-room', 905, 524, ['ห้องแยกส่วนประกอบ', 'ของเลือด'], 14),
  label('label-blood-prep-room', 'blood-prep-room', 905, 649, ['ห้องเตรียมเลือด'], 15),
  label('label-material-store', 'material-store', 1098, 350, ['คลังวัสดุ'], 11),
  label('label-microbiology-lab', 'microbiology-lab', 1210, 272, ['ห้องปฏิบัติการ', 'จุลชีววิทยาคลินิก'], 15),
  label('label-material-reagent-store', 'material-reagent-store', 1203, 403, ['คลังวัสดุและน้ำยา'], 13),
  label('label-blood-donation-room', 'blood-donation-room', 1203, 497, ['ห้องรับบริจาคเลือด', 'งานคลังเลือด'], 16),
  label('label-donor-snack-room', 'donor-snack-room', 1221, 618, ['ห้องอาหารว่าง', 'สำหรับ', 'ผู้บริจาคเลือด'], 10),
  label('label-donor-restroom-1', 'donor-restroom-1', 1314, 602, ['ห้องน้ำ'], 9),
  label('label-donor-restroom-2', 'donor-restroom-2', 1314, 635, ['ห้องน้ำ'], 9),
  label('label-office', 'office', 1051, 672, ['สำนักงาน', 'กลุ่มงานฯ'], 9),
  label('label-stair-room', 'stair-room', 888, 815, ['ห้องบันได'], 10, { rotate: -90 }),
  label('label-lift-2', 'lift-2', 941, 803, ['ลิฟท์ 2'], 9),
  label('label-lift-1', 'lift-1', 979, 803, ['ลิฟท์ 1'], 9),
  label('label-staff-waiting-area', 'staff-waiting-area', 1064, 810, ['บริเวณที่พัก', 'เจ้าหน้าที่'], 12),
  label('label-supplies-equipment-store', 'supplies-equipment-store', 1239, 795, ['ห้องเก็บพัสดุและอุปกรณ์'], 15),
  // ป้ายทางหนีไฟ — ไม่ผูกกับห้อง
  label('label-exit-3a', undefined, 82, 176, ['3A'], 15, { rotate: -90, emphasis: true }),
  label('label-exit-3a-door', undefined, 126, 178, ['ประตูหนีไฟ'], 7, { rotate: -90 }),
  label('label-exit-3b', undefined, 1399, 124, ['3B'], 15, { rotate: -90, emphasis: true }),
  // เดิม x=1368 ทับกับไอคอนทางออก (กว้างถึง x=1368) พอดี ทำให้ตัวหนังสือ "ประตูหนีไฟ" อ่านไม่ออก — ขยับให้พ้นไอคอน
  label('label-exit-3b-door', undefined, 1352, 126, ['ประตูหนีไฟ'], 7, { rotate: -90 }),
  label('label-exit-3c', undefined, 1399, 733, ['3C'], 15, { rotate: -90, emphasis: true }),
  label('label-exit-3c-door', undefined, 1352, 735, ['ประตูหนีไฟ'], 7, { rotate: -90 }),
]

export const LAB_ZONES: readonly LabZoneDefinition[] = [
  {
    code: 'central-lab-zone',
    nameTh: 'ห้องปฏิบัติการกลาง (Central Lab)',
    spaceCodes: ['central-lab'],
    workUnits: [CHEMISTRY, IMMUNOLOGY, HEMATOLOGY, MICROSCOPY],
  },
  {
    code: 'immunology-zone',
    nameTh: 'พื้นที่งานภูมิคุ้มกันวิทยาคลินิก',
    spaceCodes: ['clinical-immunology-room', 'chemical-prep'],
    workUnits: [IMMUNOLOGY],
  },
  {
    code: 'microbiology-zone',
    nameTh: 'พื้นที่งานจุลชีววิทยา',
    spaceCodes: [
      'bsl2-enhance',
      'pcr-room',
      'fungus-room',
      'microbiology-lab',
      'material-store',
      'material-reagent-store',
      'cold-material-reagent-store',
    ],
    workUnits: [MICROBIOLOGY],
  },
  {
    code: 'storage-zone',
    nameTh: 'โซนคลังวัสดุ',
    spaceCodes: ['material-store', 'material-reagent-store', 'cold-material-reagent-store'],
    workUnits: [MICROBIOLOGY],
  },
  {
    code: 'blood-bank-zone',
    nameTh: 'พื้นที่งานคลังเลือด',
    spaceCodes: ['blood-donation-room', 'blood-component-room', 'blood-prep-room', 'donor-snack-room'],
    workUnits: [BLOOD_BANK],
  },
  {
    code: 'molecular-zone',
    nameTh: 'พื้นที่งานอณูชีววิทยา',
    spaceCodes: ['molecular-biology-lab', 'genomics-lab'],
    workUnits: [MOLECULAR],
  },
  {
    code: 'special-testing-zone',
    nameTh: 'พื้นที่งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ',
    spaceCodes: ['special-testing-lab'],
    workUnits: [SPECIAL_TESTING],
  },
]

export const LAB_ACCESS_POINTS: readonly LabAccessPointDefinition[] = [
  { code: 'fingerprint-central-lab', nameTh: 'จุดสแกนนิ้วมือ ประตูห้องปฏิบัติการกลาง (บานตะวันตก)', kind: 'fingerprint', status: 'fingerprint_controlled', x: 951, y: 131 },
  { code: 'fingerprint-central-lab-second', nameTh: 'จุดสแกนนิ้วมือ ประตูห้องปฏิบัติการกลาง (บานตะวันออก)', kind: 'fingerprint', status: 'fingerprint_controlled', x: 990, y: 131 },
  { code: 'fingerprint-molecular', nameTh: 'จุดสแกนนิ้วมือ แนวกั้นข้างโซน PPE ใต้ห้องปฏิบัติการกลาง', kind: 'fingerprint', status: 'fingerprint_controlled', x: 617, y: 160 },
  { code: 'fingerprint-clinical-immunology', nameTh: 'จุดสแกนนิ้วมือ ห้องปฏิบัติการภูมิคุ้มกันวิทยาคลินิก', kind: 'fingerprint', status: 'fingerprint_controlled', x: 641, y: 206 },
  { code: 'fingerprint-microbiology', nameTh: 'จุดสแกนนิ้วมือ แนวกั้นพื้นที่งานจุลชีววิทยา', kind: 'fingerprint', status: 'fingerprint_controlled', x: 1057, y: 161 },
  { code: 'fingerprint-special-testing', nameTh: 'จุดสแกนนิ้วมือ ห้องปฏิบัติการตรวจพิเศษ', kind: 'fingerprint', status: 'fingerprint_controlled', x: 796, y: 441 },
  { code: 'fingerprint-blood-bank', nameTh: 'จุดสแกนนิ้วมือ ห้องเตรียมเลือด งานคลังเลือด', kind: 'fingerprint', status: 'fingerprint_controlled', x: 796, y: 616 },
  { code: 'fingerprint-office', nameTh: 'จุดสแกนนิ้วมือ สำนักงานกลุ่มงานเทคนิคการแพทย์', kind: 'fingerprint', status: 'fingerprint_controlled', x: 1117, y: 703 },
  // สัญลักษณ์กุญแจผูกกับบานประตูที่ล็อคถาวรจริง ไม่ใช่ตัวห้องควบคุมไฟฟ้า
  { code: 'door-locked-electrical-corridor', nameTh: 'ประตูล็อคถาวร (ทางเชื่อมห้องควบคุมไฟฟ้า)', kind: 'door', status: 'permanently_locked', x: 633, y: 333 },
  // ประตูธรรมดา ไม่มีจุดสแกนนิ้วมือ — ข้อยกเว้นเดียวที่อนุมัติแล้วให้เป็นปลายทางผู้มาติดต่อได้
  // (ดู APPROVED_NON_FINGERPRINT_VISITOR_DESTINATIONS ใน validate.ts)
  { code: 'door-meeting-room', nameTh: 'ประตูห้องประชุม', kind: 'door', status: 'open', x: 692, y: 525 },
  { code: 'exit-3a', nameTh: 'ทางออก 3A', kind: 'exit', status: 'open', x: 100, y: 175 },
  { code: 'exit-3b', nameTh: 'ทางออก 3B', kind: 'exit', status: 'open', x: 1378, y: 124 },
  { code: 'exit-3c', nameTh: 'ทางออก 3C', kind: 'exit', status: 'open', x: 1378, y: 730 },
]

export const LAB_STATIONS: readonly LabStationDefinition[] = [
  // 'installation' — จุดติดตั้งป้ายจริง เข้าแคตตาล็อกงานพิมพ์
  { code: 'office', nameTh: 'จุดติดตั้งแผนที่ หน้าสำนักงานกลุ่มงานฯ', kind: 'installation', x: 1052, y: 730, checkpointCode: 'fingerprint-office' },
  { code: 'central-corridor', nameTh: 'จุดติดตั้งแผนที่ โถงหน้าห้องปฏิบัติการกลาง', kind: 'installation', x: 770, y: 165 },
  { code: 'south-corridor', nameTh: 'จุดติดตั้งแผนที่ โถงทางเดินด้านทิศใต้', kind: 'installation', x: 700, y: 790 },
  { code: 'meeting-room', nameTh: 'จุดติดตั้งแผนที่ ห้องประชุม', kind: 'installation', x: 742, y: 525, checkpointCode: 'door-meeting-room' },
  // 'checkpoint' — จุดที่ผู้มาติดต่อยืนรอจริง วางทับพิกัดจุดสแกนเป๊ะ ๆ ไม่ใช่จุดติดตั้งป้าย
  // จึงไม่เข้าแคตตาล็อกงานพิมพ์ ใช้เป็นจุดเริ่มต้นของแผนหนีไฟให้ตรงตำแหน่งจริงของผู้มาติดต่อ
  { code: 'at-central-lab', nameTh: 'จุดสแกนนิ้วมือ ห้องปฏิบัติการกลาง', kind: 'checkpoint', x: 951, y: 131, checkpointCode: 'fingerprint-central-lab' },
  { code: 'at-clinical-immunology', nameTh: 'จุดสแกนนิ้วมือ ห้องปฏิบัติการภูมิคุ้มกันวิทยาคลินิก', kind: 'checkpoint', x: 641, y: 206, checkpointCode: 'fingerprint-clinical-immunology' },
  { code: 'at-molecular', nameTh: 'จุดสแกนนิ้วมือ งานอณูชีววิทยา', kind: 'checkpoint', x: 617, y: 160, checkpointCode: 'fingerprint-molecular' },
  { code: 'at-microbiology', nameTh: 'จุดสแกนนิ้วมือ งานจุลชีววิทยา', kind: 'checkpoint', x: 1057, y: 161, checkpointCode: 'fingerprint-microbiology' },
  { code: 'at-special-testing', nameTh: 'จุดสแกนนิ้วมือ ห้องปฏิบัติการตรวจพิเศษ', kind: 'checkpoint', x: 796, y: 441, checkpointCode: 'fingerprint-special-testing' },
  { code: 'at-blood-bank', nameTh: 'จุดสแกนนิ้วมือ งานคลังเลือด', kind: 'checkpoint', x: 796, y: 616, checkpointCode: 'fingerprint-blood-bank' },
]

/**
 * เลือกสถานีเริ่มต้นของแผนหนีไฟให้ตรงกับจุดสแกนที่ผู้มาติดต่อกำลังยืนรออยู่จริง
 * fail closed: หน่วยงานที่ไม่มีจุดสแกนคู่กัน (หรือจุดสแกนที่ยังไม่มีสถานีรองรับ) ตกไปที่ 'office'
 */
export function stationForCheckpoint(checkpointCode: string | null): string {
  if (!checkpointCode) return 'office'
  return LAB_STATIONS.find((station) => station.checkpointCode === checkpointCode)?.code ?? 'office'
}

const route = (
  code: string,
  kind: LabRoutePreset['kind'],
  fromStationCode: string,
  destinationCode: string,
  polyline: LabRoutePreset['polyline'],
  directionsTh: readonly string[],
  variant: LabRoutePreset['variant'] = 'primary',
): LabRoutePreset => ({
  code,
  kind,
  variant,
  fromStationCode,
  destinationCode,
  pointCodes: [destinationCode],
  polyline,
  directionsTh,
})

const STOP_AT_CHECKPOINT = 'หยุดที่จุดสแกนนิ้วมือ และรอเจ้าหน้าที่มารับ — ห้ามเข้าพื้นที่ต่อ'
// ประตูห้องประชุมไม่มีจุดสแกนนิ้วมือจริง จึงใช้ข้อความหยุดที่ต่างจาก STOP_AT_CHECKPOINT
// (ห้ามใช้คำว่า "จุดสแกนนิ้วมือ" เพราะไม่ตรงกับความเป็นจริงของอุปกรณ์หน้างาน)
const STOP_AT_MEETING_ROOM_DOOR = 'หยุดที่ประตูห้องประชุม และรอเจ้าหน้าที่มารับ — ห้ามเข้าไปเองก่อนได้รับอนุญาต'

export const LAB_ROUTE_PRESETS: readonly LabRoutePreset[] = [
  route('visitor-office-office', 'visitor', 'office', 'fingerprint-office',
    [[1052, 730], [1117, 730], [1117, 706], [1117, 703]],
    ['จุดสแกนอยู่ข้างประตูสำนักงาน ทางด้านขวามือ', STOP_AT_CHECKPOINT]),
  route('visitor-office-blood-bank', 'visitor', 'office', 'fingerprint-blood-bank',
    [[1052, 730], [750, 730], [750, 616], [796, 616]],
    ['เดินไปทางซ้ายตามโถงทางเดินด้านทิศใต้', 'เลี้ยวขวาเข้าโถงกลาง เดินตรงขึ้นไป', 'จุดสแกนอยู่ข้างประตูห้องเตรียมเลือด', STOP_AT_CHECKPOINT]),
  route('visitor-office-special-testing', 'visitor', 'office', 'fingerprint-special-testing',
    [[1052, 730], [750, 730], [750, 441], [796, 441]],
    ['เดินไปทางซ้ายตามโถงทางเดินด้านทิศใต้', 'เลี้ยวขวาเข้าโถงกลาง เดินตรงขึ้นไป', 'จุดสแกนอยู่ข้างห้องปฏิบัติการตรวจพิเศษ', STOP_AT_CHECKPOINT]),
  route('visitor-office-central-lab', 'visitor', 'office', 'fingerprint-central-lab',
    [[1052, 730], [750, 730], [750, 165], [951, 165], [951, 131]],
    ['เดินไปทางซ้ายตามโถงทางเดินด้านทิศใต้', 'เลี้ยวขวาเข้าโถงกลาง เดินตรงขึ้นไปจนสุด', 'เลี้ยวขวาไปที่ประตูห้องปฏิบัติการกลาง', STOP_AT_CHECKPOINT]),
  route('visitor-office-clinical-immunology', 'visitor', 'office', 'fingerprint-clinical-immunology',
    [[1052, 730], [750, 730], [750, 165], [641, 165], [641, 206]],
    ['เดินไปทางซ้ายตามโถงทางเดินด้านทิศใต้', 'เลี้ยวขวาเข้าโถงกลาง เดินตรงขึ้นไปจนสุด', 'เลี้ยวซ้ายไปที่ห้องปฏิบัติการภูมิคุ้มกันวิทยาคลินิก', STOP_AT_CHECKPOINT]),
  // งานอณูชีววิทยาไปที่แนวกั้นข้างโซน PPE ใต้ห้องปฏิบัติการกลาง — ไม่ใช่จุดของห้องภูมิคุ้มกันฯ
  route('visitor-office-molecular', 'visitor', 'office', 'fingerprint-molecular',
    [[1052, 730], [750, 730], [750, 165], [640, 165], [640, 160], [617, 160]],
    ['เดินไปทางซ้ายตามโถงทางเดินด้านทิศใต้', 'เลี้ยวขวาเข้าโถงกลาง เดินตรงขึ้นไปจนสุด', 'เลี้ยวซ้ายไปตามโถงเหนือ ผ่านห้องภูมิคุ้มกันฯ', 'จุดสแกนอยู่ที่แนวกั้นข้างโซน PPE', STOP_AT_CHECKPOINT]),
  route('visitor-office-microbiology', 'visitor', 'office', 'fingerprint-microbiology',
    [[1052, 730], [750, 730], [750, 165], [1030, 165], [1030, 161], [1057, 161]],
    ['เดินไปทางซ้ายตามโถงทางเดินด้านทิศใต้', 'เลี้ยวขวาเข้าโถงกลาง เดินตรงขึ้นไปจนสุด', 'เลี้ยวขวาไปตามโถงเหนือจนถึงแนวกั้นพื้นที่งานจุลชีววิทยา', STOP_AT_CHECKPOINT]),
  // ปลายทาง "พบหัวหน้ากลุ่มงานเทคนิคการแพทย์" — ประตูห้องประชุมไม่มีจุดสแกน เป็นข้อยกเว้นเดียว
  // ที่อนุมัติแล้วให้เป็นปลายทางผู้มาติดต่อได้ (ดู APPROVED_NON_FINGERPRINT_VISITOR_DESTINATIONS ใน validate.ts)
  route('visitor-office-meeting-room', 'visitor', 'office', 'door-meeting-room',
    [[1052, 730], [750, 730], [750, 525], [692, 525]],
    ['เดินไปทางซ้ายตามโถงทางเดินด้านทิศใต้', 'เลี้ยวขวาเข้าโถงกลาง เดินขึ้นไปจนถึงห้องประชุม', STOP_AT_MEETING_ROOM_DOOR]),

  route('evacuation-office-3c', 'evacuation', 'office', 'exit-3c',
    [[1052, 730], [1378, 730]],
    ['ออกจากสำนักงาน เลี้ยวขวาตามโถงทางเดิน', 'ออกทางประตูหนีไฟ 3C']),
  route('evacuation-office-3b', 'evacuation', 'office', 'exit-3b',
    [[1052, 730], [750, 730], [750, 165], [1200, 165], [1200, 124], [1378, 124]],
    ['หากทาง 3C ใช้ไม่ได้ ให้เลี้ยวซ้ายตามโถงทางเดิน', 'ขึ้นโถงกลางไปทางทิศเหนือ', 'เลี้ยวขวาไปสุดทาง ออกทางประตูหนีไฟ 3B'], 'alternate'),
  route('evacuation-central-3a', 'evacuation', 'central-corridor', 'exit-3a',
    [[770, 165], [100, 165], [100, 175]],
    ['เดินไปทางซ้ายตามโถงด้านทิศเหนือ', 'ออกทางประตูหนีไฟ 3A']),
  route('evacuation-central-3b', 'evacuation', 'central-corridor', 'exit-3b',
    [[770, 165], [1200, 165], [1200, 124], [1378, 124]],
    ['หากทาง 3A ใช้ไม่ได้ ให้เดินไปทางขวาตามโถงด้านทิศเหนือ', 'ออกทางประตูหนีไฟ 3B'], 'alternate'),
  route('evacuation-south-3c', 'evacuation', 'south-corridor', 'exit-3c',
    [[700, 790], [700, 730], [1378, 730]],
    ['เดินขึ้นมาที่โถงทางเดินด้านทิศใต้', 'เลี้ยวขวา ตรงไปออกทางประตูหนีไฟ 3C']),
  route('evacuation-south-3a', 'evacuation', 'south-corridor', 'exit-3a',
    [[700, 790], [700, 730], [750, 730], [750, 165], [100, 165], [100, 175]],
    ['หากทาง 3C ใช้ไม่ได้ ให้ขึ้นโถงกลางไปทางทิศเหนือ', 'เลี้ยวซ้ายไปตามโถงด้านทิศเหนือ', 'ออกทางประตูหนีไฟ 3A'], 'alternate'),

  // ── เส้นทางหนีไฟจากจุดสแกนนิ้วมือแต่ละจุด — ให้ผู้มาติดต่อเห็นแผนที่ตรงตำแหน่งที่ยืนจริง ──
  // ค่า "หลัก/สำรอง" ต่อไปนี้เป็นฉบับร่าง โดยเฉพาะ at-special-testing ที่ระยะไป 3C/3B ใกล้เคียงกันมาก
  // ต้องให้เจ้าหน้าที่ความปลอดภัยชี้ขาดตอนเดินตรวจก่อนเผยแพร่เป็นฉบับใช้งานจริง
  route('evacuation-at-central-lab-3b', 'evacuation', 'at-central-lab', 'exit-3b',
    [[951, 131], [951, 165], [1200, 165], [1200, 124], [1378, 124]],
    ['ออกจากประตูห้องปฏิบัติการกลาง เลี้ยวขวาตามโถงทิศเหนือ', 'ออกทางประตูหนีไฟ 3B']),
  route('evacuation-at-central-lab-3a', 'evacuation', 'at-central-lab', 'exit-3a',
    [[951, 131], [951, 165], [100, 165], [100, 175]],
    ['หากทาง 3B ใช้ไม่ได้ ให้เลี้ยวซ้ายตามโถงทิศเหนือ', 'ออกทางประตูหนีไฟ 3A'], 'alternate'),

  route('evacuation-at-clinical-immunology-3a', 'evacuation', 'at-clinical-immunology', 'exit-3a',
    [[641, 206], [641, 165], [100, 165], [100, 175]],
    ['ออกจากห้องปฏิบัติการภูมิคุ้มกันวิทยาคลินิก เลี้ยวซ้ายตามโถงทิศเหนือ', 'ออกทางประตูหนีไฟ 3A']),
  route('evacuation-at-clinical-immunology-3b', 'evacuation', 'at-clinical-immunology', 'exit-3b',
    [[641, 206], [641, 165], [1200, 165], [1200, 124], [1378, 124]],
    ['หากทาง 3A ใช้ไม่ได้ ให้เลี้ยวขวาตามโถงทิศเหนือ', 'ออกทางประตูหนีไฟ 3B'], 'alternate'),

  route('evacuation-at-molecular-3a', 'evacuation', 'at-molecular', 'exit-3a',
    [[617, 160], [617, 165], [100, 165], [100, 175]],
    ['ออกจากแนวกั้นข้างโซน PPE เลี้ยวซ้ายตามโถงทิศเหนือ', 'ออกทางประตูหนีไฟ 3A']),
  route('evacuation-at-molecular-3b', 'evacuation', 'at-molecular', 'exit-3b',
    [[617, 160], [617, 165], [1200, 165], [1200, 124], [1378, 124]],
    ['หากทาง 3A ใช้ไม่ได้ ให้เลี้ยวขวาตามโถงทิศเหนือ', 'ออกทางประตูหนีไฟ 3B'], 'alternate'),

  route('evacuation-at-microbiology-3b', 'evacuation', 'at-microbiology', 'exit-3b',
    [[1057, 161], [1057, 165], [1200, 165], [1200, 124], [1378, 124]],
    ['ออกจากแนวกั้นพื้นที่งานจุลชีววิทยา เลี้ยวขวาตามโถงทิศเหนือ', 'ออกทางประตูหนีไฟ 3B']),
  route('evacuation-at-microbiology-3a', 'evacuation', 'at-microbiology', 'exit-3a',
    [[1057, 161], [1057, 165], [100, 165], [100, 175]],
    ['หากทาง 3B ใช้ไม่ได้ ให้เลี้ยวซ้ายตามโถงทิศเหนือ', 'ออกทางประตูหนีไฟ 3A'], 'alternate'),

  route('evacuation-at-special-testing-3c', 'evacuation', 'at-special-testing', 'exit-3c',
    [[796, 441], [750, 441], [750, 730], [1378, 730]],
    ['ออกจากห้องปฏิบัติการตรวจพิเศษ เดินลงมาตามแกนกลาง', 'เลี้ยวซ้ายเข้าโถงทิศใต้ ตรงไปออกทางประตูหนีไฟ 3C']),
  route('evacuation-at-special-testing-3b', 'evacuation', 'at-special-testing', 'exit-3b',
    [[796, 441], [750, 441], [750, 165], [1200, 165], [1200, 124], [1378, 124]],
    ['หากทาง 3C ใช้ไม่ได้ ให้เดินขึ้นตามแกนกลางไปทางทิศเหนือ', 'เลี้ยวขวาไปสุดทาง ออกทางประตูหนีไฟ 3B'], 'alternate'),

  route('evacuation-at-blood-bank-3c', 'evacuation', 'at-blood-bank', 'exit-3c',
    [[796, 616], [750, 616], [750, 730], [1378, 730]],
    ['ออกจากห้องเตรียมเลือด เดินลงมาตามแกนกลาง', 'เลี้ยวซ้ายเข้าโถงทิศใต้ ตรงไปออกทางประตูหนีไฟ 3C']),
  route('evacuation-at-blood-bank-3b', 'evacuation', 'at-blood-bank', 'exit-3b',
    [[796, 616], [750, 616], [750, 165], [1200, 165], [1200, 124], [1378, 124]],
    ['หากทาง 3C ใช้ไม่ได้ ให้เดินขึ้นตามแกนกลางไปทางทิศเหนือ', 'เลี้ยวขวาไปสุดทาง ออกทางประตูหนีไฟ 3B'], 'alternate'),

  route('evacuation-meeting-room-3c', 'evacuation', 'meeting-room', 'exit-3c',
    [[742, 525], [750, 525], [750, 730], [1378, 730]],
    ['ออกจากห้องประชุม เดินลงมาตามแกนกลาง', 'เลี้ยวซ้ายเข้าโถงทิศใต้ ตรงไปออกทางประตูหนีไฟ 3C']),
  route('evacuation-meeting-room-3a', 'evacuation', 'meeting-room', 'exit-3a',
    [[742, 525], [750, 525], [750, 165], [100, 165], [100, 175]],
    ['หากทาง 3C ใช้ไม่ได้ ให้เดินขึ้นตามแกนกลางไปทางทิศเหนือ', 'เลี้ยวซ้ายไปตามโถงด้านทิศเหนือ', 'ออกทางประตูหนีไฟ 3A'], 'alternate'),
]

export function resolveRoutePreset(input: RoutePresetLookup): LabRoutePreset | null {
  const variant = input.variant ?? 'primary'
  return LAB_ROUTE_PRESETS.find(
    (preset) =>
      preset.kind === input.kind &&
      preset.variant === variant &&
      preset.fromStationCode === input.stationCode &&
      preset.destinationCode === input.destinationCode,
  ) ?? null
}

export function evacuationPresetsForStation(stationCode: string) {
  const presets = LAB_ROUTE_PRESETS.filter(
    (preset) => preset.kind === 'evacuation' && preset.fromStationCode === stationCode,
  )
  return {
    primary: presets.find((preset) => preset.variant === 'primary') ?? null,
    alternate: presets.find((preset) => preset.variant === 'alternate') ?? null,
  }
}
