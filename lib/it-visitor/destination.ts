import type { DEPARTMENTS } from '@/lib/validations/user-schema'

type Department = (typeof DEPARTMENTS)[number]

export interface VisitorDestination {
  destinationCode: string
  checkpointCode: string
  directionsTh: readonly string[]
}

const CENTRAL_LEFT: VisitorDestination = {
  destinationCode: 'public-central-left',
  checkpointCode: 'fingerprint-central-left',
  directionsTh: ['ออกจากสำนักงานเข้าสู่ทางเดินหลัก', 'ตรงไปทางโถงกลาง', 'เลี้ยวซ้ายและหยุดที่จุดสแกน Central Lab ฝั่งซ้าย'],
}

const CENTRAL_RIGHT: VisitorDestination = {
  destinationCode: 'public-central-right',
  checkpointCode: 'fingerprint-central-right',
  directionsTh: ['ออกจากสำนักงานเข้าสู่ทางเดินหลัก', 'ตรงไปทางทิศเหนือ', 'หยุดที่จุดสแกน Central Lab ฝั่งขวา'],
}

const DESTINATIONS: Partial<Record<Department, VisitorDestination>> = {
  'สำนักงานกลุ่มงานเทคนิคการแพทย์': {
    destinationCode: 'public-office',
    checkpointCode: 'fingerprint-office',
    directionsTh: ['ติดต่อเจ้าหน้าที่สำนักงาน ณ จุดลงทะเบียนเข้า–ออก'],
  },
  'งานเคมีคลินิก': CENTRAL_LEFT,
  'งานภูมิคุ้มกันวิทยาคลินิก': CENTRAL_LEFT,
  'งานโลหิตวิทยาคลินิก': CENTRAL_RIGHT,
  'งานจุลทรรศนศาสตร์คลินิก': CENTRAL_RIGHT,
  'งานอณูชีววิทยา': {
    destinationCode: 'public-molecular',
    checkpointCode: 'fingerprint-molecular',
    directionsTh: ['ออกจากสำนักงานเข้าสู่ทางเดินหลัก', 'ตรงไปโถงกลาง', 'เลี้ยวซ้ายและหยุดที่จุดสแกนงานอณูชีววิทยา'],
  },
  'งานจุลชีววิทยา': {
    destinationCode: 'public-microbiology',
    checkpointCode: 'fingerprint-microbiology',
    directionsTh: ['ออกจากสำนักงาน', 'ตรงไปตามทางเดินด้านขวา', 'หยุดที่จุดสแกนงานจุลชีววิทยา'],
  },
  'งานคลังเลือด': {
    destinationCode: 'public-blood-bank',
    checkpointCode: 'fingerprint-blood-bank',
    directionsTh: ['ออกจากสำนักงานเข้าสู่โถงทางเดิน', 'ตรงไปยังจุดสแกนงานคลังเลือด'],
  },
  'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ': {
    destinationCode: 'public-special-testing',
    checkpointCode: 'fingerprint-special-testing',
    directionsTh: ['ออกจากสำนักงานเข้าสู่โถงทางเดิน', 'ตรงไปยังจุดสแกนงานตรวจพิเศษ'],
  },
}

export function resolveVisitorDestination(contactDept: string): VisitorDestination | null {
  return DESTINATIONS[contactDept as Department] ?? null
}
