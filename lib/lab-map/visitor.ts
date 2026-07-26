import {
  LAB_ACCESS_POINTS,
  LAB_LABELS,
  LAB_MAP_VERSION,
  LAB_MAP_VIEW_BOX,
  LAB_ROUTE_PRESETS,
  LAB_SPACES,
  LAB_STATIONS,
  LAB_STRUCTURES,
  LAB_ZONES,
  stationForCheckpoint,
} from './manifest'
import { LAB_ASSEMBLY_POINTS, LAB_SAFETY_EQUIPMENT } from './safety-assets'
import type { DEPARTMENTS } from '@/lib/validations/user-schema'
import type { LabMapDTO, LabMapSpaceDTO } from './types'

type Department = (typeof DEPARTMENTS)[number]

/** สถานีที่ผู้มาติดต่อลงทะเบียนเข้าพื้นที่ */
export const VISITOR_STATION_CODE = 'office'

/**
 * ปลายทาง "พบหัวหน้ากลุ่มงานเทคนิคการแพทย์" — ตั้งใจไม่ใส่ใน DEPARTMENTS (lib/validations/user-schema.ts)
 * เพราะรายการนั้นถูกใช้เป็นแผนก/หน่วยงานสังกัดจริงของเจ้าหน้าที่ทั่วทั้งระบบ (โปรไฟล์ ทะเบียนเครื่องมือ
 * รายงานเอกสาร ฯลฯ) ปลายทางนี้เป็นตัวเลือกเฉพาะฟอร์มผู้มาติดต่อเท่านั้น จึงประกาศแยกไว้ที่นี่
 * แล้วให้ lib/it-visitor/constants.ts นำไปต่อท้าย DEPARTMENTS ใน dropdown แทน
 */
export const GROUP_HEAD_CONTACT_DEPT = 'หัวหน้ากลุ่มงานเทคนิคการแพทย์'

type VisitorContactDept = Department | typeof GROUP_HEAD_CONTACT_DEPT

/**
 * แผนที่หน่วยงาน → จุดสแกนนิ้วมือ กำหนดไว้ตรง ๆ และ fail closed
 * ไม่เดาจากห้องที่ใกล้ที่สุด หน่วยงานที่ไม่มีในตารางนี้จะไม่ได้เส้นทาง
 */
export const VISITOR_CHECKPOINT_BY_DEPARTMENT: Readonly<Partial<Record<VisitorContactDept, string>>> = {
  'สำนักงานกลุ่มงานเทคนิคการแพทย์': 'fingerprint-office',
  'งานเคมีคลินิก': 'fingerprint-central-lab',
  'งานโลหิตวิทยาคลินิก': 'fingerprint-central-lab',
  'งานจุลทรรศนศาสตร์คลินิก': 'fingerprint-central-lab',
  'งานภูมิคุ้มกันวิทยาคลินิก': 'fingerprint-clinical-immunology',
  // ต้องเป็นจุดบนแนวกั้นข้างโซน PPE ใต้ห้องปฏิบัติการกลาง
  // ไม่ใช่จุดที่ขอบห้องปฏิบัติการภูมิคุ้มกันวิทยาคลินิกซึ่งเป็นคนละห้อง
  'งานอณูชีววิทยา': 'fingerprint-molecular',
  'งานจุลชีววิทยา': 'fingerprint-microbiology',
  'งานคลังเลือด': 'fingerprint-blood-bank',
  'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ': 'fingerprint-special-testing',
  // ประตูห้องประชุมไม่มีจุดสแกนนิ้วมือจริง — ข้อยกเว้นเดียวที่อนุมัติแล้ว
  // (ดู APPROVED_NON_FINGERPRINT_VISITOR_DESTINATIONS ใน validate.ts)
  [GROUP_HEAD_CONTACT_DEPT]: 'door-meeting-room',
}

export interface VisitorDestination {
  checkpointCode: string
  checkpointNameTh: string
  routeCode: string
  directionsTh: readonly string[]
  /** สถานีความปลอดภัยที่ตรงกับจุดสแกนนี้ — ใช้เป็นจุดเริ่มต้นของแผนหนีไฟให้ตรงตำแหน่งจริง */
  safetyStationCode: string
}

export function resolveVisitorDestination(contactDept: string): VisitorDestination | null {
  const checkpointCode = VISITOR_CHECKPOINT_BY_DEPARTMENT[contactDept as VisitorContactDept]
  if (!checkpointCode) return null

  const checkpoint = LAB_ACCESS_POINTS.find((point) => point.code === checkpointCode)
  const preset = LAB_ROUTE_PRESETS.find(
    (candidate) =>
      candidate.kind === 'visitor' &&
      candidate.fromStationCode === VISITOR_STATION_CODE &&
      candidate.destinationCode === checkpointCode,
  )
  if (!checkpoint || !preset) return null

  return {
    checkpointCode,
    checkpointNameTh: checkpoint.nameTh,
    routeCode: preset.code,
    directionsTh: preset.directionsTh,
    safetyStationCode: stationForCheckpoint(checkpointCode),
  }
}

/** ตัดข้อมูลเฉพาะเจ้าหน้าที่ออก — ไม่มีการจำแนกพื้นที่ติดเชื้อในฝั่งผู้มาติดต่อ */
function toVisitorSpace(space: (typeof LAB_SPACES)[number]): LabMapSpaceDTO {
  const { infectionClass: _infectionClass, ...rest } = space
  return rest
}

/**
 * DTO สำหรับป๊อปอัพในบัตรผู้มาติดต่อ — ใช้เรขาคณิตและชื่อห้องชุดเดียวกับฝั่งเจ้าหน้าที่
 * ไม่มี manifest สาธารณะแยกอีกชุด
 *
 * ส่งสถานีและเส้นทางหนีไฟของ "ทุก" จุดสแกน ไม่ใช่เฉพาะสำนักงาน — ผู้มาติดต่อที่ยืนรอที่จุดสแกน
 * อื่นต้องเห็นแผนหนีไฟที่เริ่มจากตำแหน่งจริงที่ตนยืนอยู่ ไม่ใช่แผนของสำนักงานเสมอ
 * (เส้นทางนำทางไปจุดสแกน ยังคงจำกัดเฉพาะที่ออกจากสำนักงานเหมือนเดิม เพราะเป็นจุดลงทะเบียนเดียว)
 */
export function buildVisitorLabMapDTO(published?: {
  versionCode: string
  safetyEquipment: LabMapDTO['safetyEquipment']
  assemblyPoints: LabMapDTO['assemblyPoints']
} | null): LabMapDTO {
  return {
    version: published?.versionCode ?? LAB_MAP_VERSION,
    releaseStatus: published ? 'published' : 'draft',
    viewBox: LAB_MAP_VIEW_BOX,
    stationCode: VISITOR_STATION_CODE,
    structures: LAB_STRUCTURES,
    spaces: LAB_SPACES.map(toVisitorSpace),
    labels: LAB_LABELS,
    zones: LAB_ZONES,
    accessPoints: LAB_ACCESS_POINTS,
    stations: LAB_STATIONS,
    routes: LAB_ROUTE_PRESETS.filter(
      (preset) =>
        (preset.kind === 'visitor' && preset.fromStationCode === VISITOR_STATION_CODE) ||
        preset.kind === 'evacuation',
    ),
    safetyEquipment: published?.safetyEquipment ?? LAB_SAFETY_EQUIPMENT,
    assemblyPoints: published?.assemblyPoints ?? LAB_ASSEMBLY_POINTS,
  }
}
