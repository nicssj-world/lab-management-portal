import type {
  LabAccessPointDefinition,
  LabMapSpaceDTO,
  LabRoutePreset,
  LabStationDefinition,
  LabZoneDefinition,
  SvgShape,
} from './types'

export const PUBLIC_LAB_MAP_VERSION = 'F3-2026.07.26-01-public'
export const PUBLIC_LAB_VIEW_BOX = '0 0 1487 893'

const rect = (x: number, y: number, width: number, height: number): SvgShape => ({
  type: 'rect',
  x,
  y,
  width,
  height,
})

const publicSpace = (
  code: string,
  nameTh: string,
  shape: SvgShape,
  workUnits: readonly string[],
  controlled = false,
): LabMapSpaceDTO => ({ code, nameTh, shape, workUnits, controlled })

export const PUBLIC_LAB_SPACES: readonly LabMapSpaceDTO[] = [
  publicSpace('public-office', 'สำนักงานกลุ่มงานเทคนิคการแพทย์', rect(1012, 652, 86, 56), ['สำนักงานกลุ่มงานเทคนิคการแพทย์']),
  publicSpace('public-central-left', 'Central Lab ฝั่งซ้าย — งานเคมีคลินิกและงานภูมิคุ้มกันวิทยาคลินิก', rect(404, 22, 322, 113), ['งานเคมีคลินิก', 'งานภูมิคุ้มกันวิทยาคลินิก'], true),
  publicSpace('public-central-right', 'Central Lab ฝั่งขวา — งานโลหิตวิทยาคลินิกและงานจุลทรรศนศาสตร์คลินิก', rect(726, 22, 322, 113), ['งานโลหิตวิทยาคลินิก', 'งานจุลทรรศนศาสตร์คลินิก'], true),
  publicSpace('public-molecular', 'พื้นที่งานอณูชีววิทยา — เฉพาะเจ้าหน้าที่', rect(46, 210, 312, 85), ['งานอณูชีววิทยา'], true),
  publicSpace('public-microbiology', 'พื้นที่งานจุลชีววิทยา — เฉพาะเจ้าหน้าที่', rect(1060, 162, 292, 278), ['งานจุลชีววิทยา'], true),
  publicSpace('public-special-testing', 'พื้นที่งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ — เฉพาะเจ้าหน้าที่', rect(802, 385, 208, 98), ['งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ'], true),
  publicSpace('public-blood-bank', 'พื้นที่งานคลังเลือด — ติดต่อที่จุดสแกนนิ้วมือ', rect(802, 483, 550, 224), ['งานคลังเลือด'], true),
  publicSpace('public-main-corridor', 'ทางเดินสาธารณะ', {
    type: 'polygon',
    points: [[358, 136], [1408, 136], [1408, 212], [1058, 212], [1058, 765], [578, 765], [578, 666], [795, 666], [795, 212], [358, 212]],
  }, []),
]

export const PUBLIC_LAB_ZONES: readonly LabZoneDefinition[] = [
  {
    code: 'public-central-lab',
    nameTh: 'ห้องปฏิบัติการกลาง (Central Lab)',
    spaceCodes: ['public-central-left', 'public-central-right'],
    workUnits: ['งานเคมีคลินิก', 'งานภูมิคุ้มกันวิทยาคลินิก', 'งานโลหิตวิทยาคลินิก', 'งานจุลทรรศนศาสตร์คลินิก'],
  },
]

export const PUBLIC_LAB_ACCESS_POINTS: readonly LabAccessPointDefinition[] = [
  { code: 'fingerprint-central-left', nameTh: 'จุดสแกนนิ้วมือ Central Lab ฝั่งซ้าย', kind: 'fingerprint', status: 'fingerprint_controlled', x: 620, y: 166 },
  { code: 'fingerprint-molecular', nameTh: 'จุดสแกนนิ้วมืองานอณูชีววิทยา', kind: 'fingerprint', status: 'fingerprint_controlled', x: 644, y: 210 },
  { code: 'fingerprint-central-right', nameTh: 'จุดสแกนนิ้วมือ Central Lab ฝั่งขวา', kind: 'fingerprint', status: 'fingerprint_controlled', x: 1063, y: 166 },
  { code: 'fingerprint-microbiology', nameTh: 'จุดสแกนนิ้วมืองานจุลชีววิทยา', kind: 'fingerprint', status: 'fingerprint_controlled', x: 1058, y: 384 },
  { code: 'fingerprint-special-testing', nameTh: 'จุดสแกนนิ้วมืองานตรวจพิเศษ', kind: 'fingerprint', status: 'fingerprint_controlled', x: 800, y: 448 },
  { code: 'fingerprint-blood-bank', nameTh: 'จุดสแกนนิ้วมืองานคลังเลือด', kind: 'fingerprint', status: 'fingerprint_controlled', x: 800, y: 622 },
  { code: 'fingerprint-office', nameTh: 'จุดสแกนนิ้วมือสำนักงานกลุ่มงานฯ', kind: 'fingerprint', status: 'fingerprint_controlled', x: 1122, y: 708 },
  { code: 'exit-3a', nameTh: 'ทางออก 3A', kind: 'exit', status: 'open', x: 96, y: 180 },
  { code: 'exit-3b', nameTh: 'ทางออก 3B', kind: 'exit', status: 'open', x: 1408, y: 137 },
  { code: 'exit-3c', nameTh: 'ทางออก 3C', kind: 'exit', status: 'open', x: 1408, y: 748 },
]

export const PUBLIC_LAB_STATIONS: readonly LabStationDefinition[] = [
  { code: 'office', nameTh: 'สำนักงานกลุ่มงานเทคนิคการแพทย์', x: 1110, y: 708 },
  { code: 'central-corridor', nameTh: 'โถงหน้าห้องปฏิบัติการกลาง', x: 770, y: 180 },
  { code: 'south-corridor', nameTh: 'โถงทางเดินด้านทิศใต้', x: 744, y: 718 },
]

const publicRoute = (
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

export const PUBLIC_LAB_ROUTES: readonly LabRoutePreset[] = [
  publicRoute('visitor-office-central-left', 'visitor', 'office', 'fingerprint-central-left', [[1110, 708], [1055, 708], [1055, 668], [795, 668], [795, 181], [620, 181], [620, 166]], ['ออกจากสำนักงานเข้าสู่ทางเดินหลัก', 'ตรงไปทางโถงกลาง', 'เลี้ยวซ้ายและหยุดที่จุดสแกน Central Lab ฝั่งซ้าย']),
  publicRoute('visitor-office-central-right', 'visitor', 'office', 'fingerprint-central-right', [[1110, 708], [1055, 708], [1055, 181], [1063, 181], [1063, 166]], ['ออกจากสำนักงานเข้าสู่ทางเดินหลัก', 'ตรงไปทางทิศเหนือ', 'หยุดที่จุดสแกน Central Lab ฝั่งขวา']),
  publicRoute('visitor-office-molecular', 'visitor', 'office', 'fingerprint-molecular', [[1110, 708], [795, 708], [795, 210], [644, 210]], ['ออกจากสำนักงานเข้าสู่ทางเดินหลัก', 'ตรงไปโถงกลาง', 'เลี้ยวซ้ายและหยุดที่จุดสแกนงานอณูชีววิทยา']),
  publicRoute('visitor-office-microbiology', 'visitor', 'office', 'fingerprint-microbiology', [[1110, 708], [1058, 708], [1058, 384]], ['ออกจากสำนักงาน', 'ตรงไปตามทางเดินด้านขวา', 'หยุดที่จุดสแกนงานจุลชีววิทยา']),
  publicRoute('visitor-office-special-testing', 'visitor', 'office', 'fingerprint-special-testing', [[1110, 708], [795, 708], [795, 448], [800, 448]], ['ออกจากสำนักงานเข้าสู่โถงทางเดิน', 'ตรงไปยังจุดสแกนงานตรวจพิเศษ']),
  publicRoute('visitor-office-blood-bank', 'visitor', 'office', 'fingerprint-blood-bank', [[1110, 708], [800, 708], [800, 622]], ['ออกจากสำนักงานเข้าสู่โถงทางเดิน', 'ตรงไปยังจุดสแกนงานคลังเลือด']),
  publicRoute('evacuation-office-3c', 'evacuation', 'office', 'exit-3c', [[1110, 708], [1160, 708], [1160, 748], [1408, 748]], ['ออกจากสำนักงาน', 'ไปทางขวาตามป้ายทางออก 3C']),
  publicRoute('evacuation-central-3a', 'evacuation', 'central-corridor', 'exit-3a', [[770, 180], [360, 180], [96, 180]], ['ไปทางซ้ายตามโถง', 'ออกทาง 3A']),
  publicRoute('evacuation-south-3c', 'evacuation', 'south-corridor', 'exit-3c', [[744, 718], [1160, 718], [1160, 748], [1408, 748]], ['ไปทางขวาตามโถงทางเดิน', 'ออกทาง 3C']),
]
