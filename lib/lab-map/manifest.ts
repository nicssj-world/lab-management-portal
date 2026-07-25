import type { DEPARTMENTS } from '@/lib/validations/user-schema'
import type {
  LabAccessPointDefinition,
  LabRoutePreset,
  LabSpaceDefinition,
  LabStationDefinition,
  LabZoneDefinition,
  RoutePresetLookup,
  SvgShape,
} from './types'

type WorkUnit = (typeof DEPARTMENTS)[number]

export const LAB_MAP_VERSION = 'F3-2026.07.26-01'
export const LAB_MAP_VIEW_BOX = '0 0 1487 893'

const rect = (x: number, y: number, width: number, height: number): SvgShape => ({
  type: 'rect',
  x,
  y,
  width,
  height,
})

const space = (
  code: string,
  nameTh: string,
  shape: SvgShape,
  infectionClass: LabSpaceDefinition['infectionClass'],
  workUnits: readonly WorkUnit[] = [],
  controlled = false,
  nameEn?: string,
): LabSpaceDefinition => ({
  code,
  nameTh,
  nameEn,
  shape,
  infectionClass,
  workUnits,
  controlled,
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

export const REQUIRED_SPACE_CODES = [
  'office',
  'group-head-office',
  'meeting-room',
  'central-lab-left',
  'central-lab-right',
  'clinical-immunology-room',
  'molecular-biology-lab',
  'genomics-lab',
  'microbiology-lab',
  'infectious-diagnosis-room',
  'bsl2-enhance',
  'pcr-room',
  'culture-media-prep',
  'specimen-prep',
  'material-store',
  'material-reagent-store',
  'cold-material-reagent-store',
  'special-testing-lab',
  'blood-donation-room',
  'blood-component-room',
  'blood-prep-room',
  'ppe-zone',
  'equipment-wash',
  'chemical-prep',
  'electrical-control',
  'computer-control',
] as const

export const LAB_SPACES: readonly LabSpaceDefinition[] = [
  space('restroom-northwest-1', 'ห้องน้ำ', rect(94, 22, 68, 76), 'clean'),
  space('staff-dining-northwest', 'ห้องอาหาร', rect(162, 22, 56, 76), 'clean', [OFFICE]),
  space('restroom-northwest-2', 'ห้องน้ำ', rect(94, 98, 68, 58), 'clean'),
  space('staff-rest-room', 'ห้องพักเวรเจ้าหน้าที่', rect(218, 22, 186, 113), 'clean', [OFFICE]),
  space(
    'central-lab-left',
    'ห้องปฏิบัติการกลาง — ฝั่งซ้าย',
    rect(404, 22, 322, 113),
    'infectious',
    [CHEMISTRY, IMMUNOLOGY],
    true,
    'Central Lab — Left',
  ),
  space(
    'central-lab-right',
    'ห้องปฏิบัติการกลาง — ฝั่งขวา',
    rect(726, 22, 322, 113),
    'infectious',
    [HEMATOLOGY, MICROSCOPY],
    true,
    'Central Lab — Right',
  ),
  space('bsl2-enhance', 'BSL2 Enhance', rect(1048, 22, 135, 113), 'infectious', [MICROBIOLOGY], true),
  space('restroom-northeast', 'ห้องน้ำ', rect(1218, 22, 48, 76), 'clean'),
  space('pcr-room', 'ห้อง PCR', rect(1266, 22, 86, 76), 'infectious', [MICROBIOLOGY], true),
  space('purchase-room', 'ห้องจัดซื้อ', rect(1248, 162, 104, 50), 'infectious', [MICROBIOLOGY], true),

  space('genomics-lab', 'ห้องปฏิบัติการจีโนมิกส์', rect(46, 210, 190, 85), 'infectious', [MOLECULAR], true),
  space('molecular-biology-lab', 'ห้องปฏิบัติการอณูชีววิทยา', rect(236, 210, 122, 85), 'infectious', [MOLECULAR], true),
  space('equipment-wash', 'ห้องล้างอุปกรณ์', rect(357, 269, 152, 113), 'infectious'),
  space('ppe-zone', 'โซน PPE', rect(500, 180, 105, 32), 'clean'),
  space('clinical-immunology-room', 'ห้องปฏิบัติการภูมิคุ้มกันวิทยาคลินิก', rect(548, 212, 145, 66), 'infectious', [IMMUNOLOGY], true),
  space('chemical-prep', 'ห้องเตรียมสารเคมี', rect(508, 299, 109, 40), 'risk', [CHEMISTRY, IMMUNOLOGY], true),
  space('electrical-control', 'ห้องควบคุมไฟฟ้า', rect(508, 339, 109, 44), 'clean'),
  space('computer-control', 'ห้องควบคุมระบบคอมพิวเตอร์', rect(508, 383, 185, 45), 'clean', [OFFICE]),
  space('meeting-room', 'ห้องประชุม', rect(508, 428, 185, 170), 'clean', [OFFICE]),
  space('group-head-office', 'ห้องหัวหน้ากลุ่มงานเทคนิคการแพทย์', rect(508, 598, 185, 68), 'clean', [OFFICE]),
  space('office', 'สำนักงานกลุ่มงานเทคนิคการแพทย์', rect(1012, 652, 86, 56), 'clean', [OFFICE]),

  space('locker-room', 'ห้อง Locker จนท.', rect(802, 214, 104, 98), 'clean', [OFFICE]),
  space('microbiology-staff-room', 'ห้องพัก จนท. งานจุลชีววิทยา', rect(906, 214, 104, 98), 'clean', [MICROBIOLOGY]),
  space('cold-material-reagent-store', 'ห้องเก็บวัสดุและน้ำยาแช่เย็น', rect(802, 312, 208, 73), 'clean', [MICROBIOLOGY], true),
  space('special-testing-lab', 'ห้องปฏิบัติการตรวจพิเศษ', rect(802, 385, 208, 98), 'infectious', [SPECIAL_TESTING], true),
  space('blood-component-room', 'ห้องแยกส่วนประกอบของเลือด', rect(802, 483, 208, 114), 'infectious', [BLOOD_BANK], true),
  space('blood-prep-room', 'ห้องเตรียมเลือด', rect(802, 597, 208, 110), 'infectious', [BLOOD_BANK], true),

  space('culture-media-prep', 'ห้องเตรียมอาหารเลี้ยงเชื้อ', rect(1060, 212, 84, 114), 'infectious', [MICROBIOLOGY], true),
  space('specimen-prep', 'ห้องเตรียมตัวอย่าง', rect(1144, 212, 63, 172), 'infectious', [MICROBIOLOGY], true),
  space('microbiology-lab', 'ห้องปฏิบัติการจุลชีววิทยาคลินิก', rect(1207, 212, 145, 92), 'infectious', [MICROBIOLOGY], true),
  space('infectious-diagnosis-room', 'ห้องวินิจฉัยเชื้อ', rect(1207, 304, 145, 80), 'infectious', [MICROBIOLOGY], true),
  space('material-store', 'คลังวัสดุ', rect(1060, 326, 84, 58), 'clean', [MICROBIOLOGY], true),
  space('material-reagent-store', 'คลังวัสดุและน้ำยา', rect(1060, 384, 292, 56), 'clean', [MICROBIOLOGY], true),
  space('blood-donation-room', 'ห้องรับบริจาคเลือด', rect(1060, 440, 292, 212), 'infectious', [BLOOD_BANK], true),
  space('donor-snack-room', 'ห้องอาหารว่างสำหรับผู้บริจาคเลือด', rect(1164, 587, 112, 109), 'clean', [BLOOD_BANK]),

  space('staff-waiting-area', 'บริเวณที่พักเจ้าหน้าที่', rect(1001, 784, 132, 82), 'clean', [OFFICE]),
  space('supplies-equipment-store', 'ห้องเก็บพัสดุและอุปกรณ์', rect(1133, 767, 218, 78), 'clean', [OFFICE]),
  space('south-restroom-1', 'ห้องน้ำ', rect(510, 666, 68, 50), 'clean'),
  space('south-restroom-2', 'ห้องน้ำ', rect(510, 716, 68, 51), 'clean'),
  space('south-restroom-3', 'ห้องน้ำ', rect(510, 767, 68, 49), 'clean'),
  space('lift-1', 'ลิฟต์ 1', rect(963, 765, 39, 80), 'clean'),
  space('lift-2', 'ลิฟต์ 2', rect(924, 765, 39, 80), 'clean'),
  space('lift-3', 'ลิฟต์ 3', rect(510, 816, 68, 29), 'clean'),
  space('lift-4', 'ลิฟต์ 4', rect(510, 845, 68, 21), 'clean'),
  space('stair-south', 'บันได', rect(855, 765, 69, 80), 'clean'),
]

export const LAB_ZONES: readonly LabZoneDefinition[] = [
  {
    code: 'central-lab',
    nameTh: 'ห้องปฏิบัติการกลาง (Central Lab)',
    spaceCodes: ['central-lab-left', 'central-lab-right'],
    workUnits: [CHEMISTRY, IMMUNOLOGY, HEMATOLOGY, MICROSCOPY],
  },
  {
    code: 'central-lab-left-zone',
    nameTh: 'Central Lab ฝั่งซ้าย',
    spaceCodes: ['central-lab-left'],
    workUnits: [CHEMISTRY, IMMUNOLOGY],
  },
  {
    code: 'central-lab-right-zone',
    nameTh: 'Central Lab ฝั่งขวา',
    spaceCodes: ['central-lab-right'],
    workUnits: [HEMATOLOGY, MICROSCOPY],
  },
  {
    code: 'microbiology-zone',
    nameTh: 'พื้นที่งานจุลชีววิทยา',
    spaceCodes: [
      'bsl2-enhance',
      'pcr-room',
      'culture-media-prep',
      'specimen-prep',
      'microbiology-lab',
      'infectious-diagnosis-room',
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
]

export const LAB_ACCESS_POINTS: readonly LabAccessPointDefinition[] = [
  { code: 'fingerprint-central-left', nameTh: 'จุดสแกนนิ้วมือ Central Lab ฝั่งซ้าย', kind: 'fingerprint', status: 'fingerprint_controlled', x: 620, y: 166 },
  { code: 'fingerprint-molecular', nameTh: 'จุดสแกนนิ้วมืองานอณูชีววิทยา', kind: 'fingerprint', status: 'fingerprint_controlled', x: 644, y: 210 },
  { code: 'fingerprint-central-right', nameTh: 'จุดสแกนนิ้วมือ Central Lab ฝั่งขวา', kind: 'fingerprint', status: 'fingerprint_controlled', x: 1063, y: 166 },
  { code: 'fingerprint-microbiology', nameTh: 'จุดสแกนนิ้วมืองานจุลชีววิทยา', kind: 'fingerprint', status: 'fingerprint_controlled', x: 1058, y: 384 },
  { code: 'fingerprint-special-testing', nameTh: 'จุดสแกนนิ้วมืองานตรวจพิเศษ', kind: 'fingerprint', status: 'fingerprint_controlled', x: 800, y: 448 },
  { code: 'fingerprint-blood-bank', nameTh: 'จุดสแกนนิ้วมืองานคลังเลือด', kind: 'fingerprint', status: 'fingerprint_controlled', x: 800, y: 622 },
  { code: 'fingerprint-office', nameTh: 'จุดสแกนนิ้วมือสำนักงานกลุ่มงานฯ', kind: 'fingerprint', status: 'fingerprint_controlled', x: 1122, y: 708 },
  { code: 'door-central-left', nameTh: 'ประตู Central Lab ฝั่งซ้าย', kind: 'door', status: 'open', x: 588, y: 135 },
  { code: 'door-central-right', nameTh: 'ประตู Central Lab ฝั่งขวา', kind: 'door', status: 'open', x: 982, y: 135 },
  { code: 'door-electrical-control', nameTh: 'ประตูห้องควบคุมไฟฟ้า (ล็อคถาวร)', kind: 'door', status: 'permanently_locked', x: 617, y: 361 },
  { code: 'exit-3a', nameTh: 'ทางออก 3A', kind: 'exit', status: 'open', x: 96, y: 180 },
  { code: 'exit-3b', nameTh: 'ทางออก 3B', kind: 'exit', status: 'open', x: 1408, y: 137 },
  { code: 'exit-3c', nameTh: 'ทางออก 3C', kind: 'exit', status: 'open', x: 1408, y: 748 },
]

export const LAB_STATIONS: readonly LabStationDefinition[] = [
  { code: 'office', nameTh: 'สำนักงานกลุ่มงานเทคนิคการแพทย์', x: 1110, y: 708 },
  { code: 'central-corridor', nameTh: 'โถงหน้าห้องปฏิบัติการกลาง', x: 770, y: 180 },
  { code: 'south-corridor', nameTh: 'โถงทางเดินด้านทิศใต้', x: 744, y: 718 },
]

const route = (
  code: string,
  kind: LabRoutePreset['kind'],
  fromStationCode: string,
  destinationCode: string,
  polyline: LabRoutePreset['polyline'],
  directionsTh: readonly string[],
  pointCodes: readonly string[] = [destinationCode],
  variant: LabRoutePreset['variant'] = 'primary',
): LabRoutePreset => ({
  code,
  kind,
  variant,
  fromStationCode,
  destinationCode,
  pointCodes,
  polyline,
  directionsTh,
})

export const LAB_ROUTE_PRESETS: readonly LabRoutePreset[] = [
  route('visitor-office-central-left', 'visitor', 'office', 'fingerprint-central-left', [[1110, 708], [1055, 708], [1055, 668], [795, 668], [795, 181], [620, 181], [620, 166]], ['ออกจากสำนักงานเข้าสู่ทางเดินหลัก', 'ตรงไปทางโถงกลาง', 'เลี้ยวซ้ายไปยังจุดสแกน Central Lab ฝั่งซ้าย']),
  route('visitor-office-central-right', 'visitor', 'office', 'fingerprint-central-right', [[1110, 708], [1055, 708], [1055, 181], [1063, 181], [1063, 166]], ['ออกจากสำนักงานเข้าสู่ทางเดินหลัก', 'ตรงไปทางทิศเหนือ', 'หยุดที่จุดสแกน Central Lab ฝั่งขวา']),
  route('visitor-office-molecular', 'visitor', 'office', 'fingerprint-molecular', [[1110, 708], [795, 708], [795, 210], [644, 210]], ['ออกจากสำนักงานเข้าสู่ทางเดินหลัก', 'ตรงไปโถงกลาง', 'เลี้ยวซ้ายและหยุดที่จุดสแกนงานอณูชีววิทยา']),
  route('visitor-office-microbiology', 'visitor', 'office', 'fingerprint-microbiology', [[1110, 708], [1058, 708], [1058, 384]], ['ออกจากสำนักงาน', 'ตรงไปตามทางเดินด้านขวา', 'หยุดที่จุดสแกนงานจุลชีววิทยา']),
  route('visitor-office-special-testing', 'visitor', 'office', 'fingerprint-special-testing', [[1110, 708], [795, 708], [795, 448], [800, 448]], ['ออกจากสำนักงานเข้าสู่โถงทางเดิน', 'ตรงไปยังจุดสแกนงานตรวจพิเศษ']),
  route('visitor-office-blood-bank', 'visitor', 'office', 'fingerprint-blood-bank', [[1110, 708], [800, 708], [800, 622]], ['ออกจากสำนักงานเข้าสู่โถงทางเดิน', 'ตรงไปยังจุดสแกนงานคลังเลือด']),
  route('evacuation-office-3c', 'evacuation', 'office', 'exit-3c', [[1110, 708], [1160, 708], [1160, 748], [1408, 748]], ['ออกจากสำนักงาน', 'ไปทางขวาตามป้ายทางออก 3C'], ['exit-3c']),
  route('evacuation-office-3b-alternate', 'evacuation', 'office', 'exit-3b', [[1110, 708], [1058, 708], [1058, 181], [1408, 181], [1408, 137]], ['ออกจากสำนักงาน', 'ไปทางทิศเหนือ', 'ออกทาง 3B'], ['exit-3b'], 'alternate'),
  route('evacuation-central-3a', 'evacuation', 'central-corridor', 'exit-3a', [[770, 180], [360, 180], [96, 180]], ['ไปทางซ้ายตามโถง', 'ออกทาง 3A'], ['exit-3a']),
  route('evacuation-central-3b-alternate', 'evacuation', 'central-corridor', 'exit-3b', [[770, 180], [1408, 180], [1408, 137]], ['ไปทางขวาตามโถง', 'ออกทาง 3B'], ['exit-3b'], 'alternate'),
  route('evacuation-south-3c', 'evacuation', 'south-corridor', 'exit-3c', [[744, 718], [1160, 718], [1160, 748], [1408, 748]], ['ไปทางขวาตามโถงทางเดิน', 'ออกทาง 3C'], ['exit-3c']),
  route('evacuation-south-3a-alternate', 'evacuation', 'south-corridor', 'exit-3a', [[744, 718], [356, 718], [356, 180], [96, 180]], ['ไปทางซ้าย', 'ขึ้นทางเดินฝั่งตะวันตก', 'ออกทาง 3A'], ['exit-3a'], 'alternate'),
]

export function resolveRoutePreset(input: RoutePresetLookup): LabRoutePreset | null {
  const variant = input.variant ?? 'primary'
  return LAB_ROUTE_PRESETS.find(
    (route) =>
      route.kind === input.kind &&
      route.variant === variant &&
      route.fromStationCode === input.stationCode &&
      route.destinationCode === input.destinationCode,
  ) ?? null
}
