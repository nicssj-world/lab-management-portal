// ผังการจัดเก็บสารเคมีในห้องเก็บสารเคมีกลุ่มงานเทคนิคการแพทย์
//
// แหล่งอ้างอิงคือ "ผังการจัดเก็บสารเคมี" ฉบับปรับปรุง 2 กุมภาพันธ์ 2569 ไม่ใช่คอลัมน์
// "ตำแหน่งจัดเก็บ" ของ master list — master list เขียนกำกวมว่า "B3, B4" สำหรับสาร 6 ตัว
// แต่ผังระบุตู้เดี่ยวชัดเจน จึงยึดตามผัง
import type {
  ChemicalPositionAssignment,
  ChemicalStorageLocationDefinition,
  ChemicalStorageZoneCode,
} from './types'

export const LOCATION_GROUP_COLORS = {
  A: '#1557C0',
  B: '#137333',
  C: '#F04B00',
  T: '#642A91',
} as const

export interface ChemicalZoneMeta {
  code: ChemicalStorageZoneCode
  /** หัวข้อโซนตามที่เขียนไว้ในผัง */
  titleTh: string
  color: string
  /** ลำดับการวางบนผัง — A/T แถวบน, B แถวกลาง, C แถวล่าง */
  displayRow: number
}

export const CHEMICAL_ZONE_META: readonly ChemicalZoneMeta[] = Object.freeze([
  { code: 'A', titleTh: 'ตำแหน่ง A', color: LOCATION_GROUP_COLORS.A, displayRow: 1 },
  { code: 'T', titleTh: 'ตำแหน่ง T โต๊ะ', color: LOCATION_GROUP_COLORS.T, displayRow: 1 },
  { code: 'B', titleTh: 'ตำแหน่ง B', color: LOCATION_GROUP_COLORS.B, displayRow: 2 },
  { code: 'C', titleTh: 'ตำแหน่ง C ตู้เหล็กข้างประตู', color: LOCATION_GROUP_COLORS.C, displayRow: 3 },
])

export interface ChemicalGroupSummaryRow {
  groupTh: string
  /** รหัสตู้ที่กลุ่มนี้ถูกจัดเก็บ ตามตาราง "สรุปกลุ่มสารเคมีตามประเภท" ในผัง */
  locationCodes: readonly string[]
}

// เหตุผลของการแยกตู้ — สำคัญพอ ๆ กับตัวตำแหน่ง เพราะเป็นหลักการแยกสารที่เข้ากันไม่ได้
export const CHEMICAL_GROUP_SUMMARY: readonly ChemicalGroupSummaryRow[] = Object.freeze([
  { groupTh: 'กลุ่มสารไวไฟ (Alcohol 70%, Alc. Hand Rub)', locationCodes: ['A1'] },
  { groupTh: 'กลุ่มสารไวไฟ (Alcohol 95%)', locationCodes: ['A2'] },
  { groupTh: 'กลุ่มสารไวไฟ (Methanol)', locationCodes: ['T2'] },
  { groupTh: 'กลุ่มสารไวไฟ (อื่นๆ)', locationCodes: ['B3', 'B4'] },
  { groupTh: 'กลุ่มสารเคมีที่มีฤทธิ์กัดกร่อน ชนิดของเหลว', locationCodes: ['C1', 'C2', 'C3', 'C4', 'C5'] },
  { groupTh: 'กลุ่มสารเคมีที่เป็นต่างชนิดของแข็ง', locationCodes: ['B2'] },
  { groupTh: 'กลุ่มสารเคมีที่เป็นสีย้อมต่างๆ', locationCodes: ['B1', 'T1'] },
])

export const CHEMICAL_LAYOUT_UPDATED_LABEL = '2 กุมภาพันธ์ 2569'
export const CHEMICAL_ROOM_NAME_TH = 'ห้องเก็บสารเคมี'

export const CHEMICAL_PREP_LOCATIONS = [
  { code: 'A1', zoneCode: 'A', locationKind: 'cabinet', displayOrder: 1 },
  { code: 'A2', zoneCode: 'A', locationKind: 'cabinet', displayOrder: 2 },
  { code: 'B1', zoneCode: 'B', locationKind: 'cabinet', displayOrder: 3 },
  { code: 'B2', zoneCode: 'B', locationKind: 'cabinet', displayOrder: 4 },
  { code: 'B3', zoneCode: 'B', locationKind: 'cabinet', displayOrder: 5 },
  { code: 'B4', zoneCode: 'B', locationKind: 'cabinet', displayOrder: 6 },
  { code: 'C1', zoneCode: 'C', locationKind: 'cabinet', displayOrder: 7 },
  { code: 'C2', zoneCode: 'C', locationKind: 'cabinet', displayOrder: 8 },
  { code: 'C3', zoneCode: 'C', locationKind: 'cabinet', displayOrder: 9 },
  { code: 'C4', zoneCode: 'C', locationKind: 'cabinet', displayOrder: 10 },
  { code: 'C5', zoneCode: 'C', locationKind: 'cabinet', displayOrder: 11 },
  { code: 'T1', zoneCode: 'T', locationKind: 'table', displayOrder: 12 },
  { code: 'T2', zoneCode: 'T', locationKind: 'table', displayOrder: 13 },
] as const satisfies readonly ChemicalStorageLocationDefinition[]

export const INITIAL_POSITION_ASSIGNMENTS = [
  { positionCode: 'A1', name: '70% Alcohol' },
  { positionCode: 'A1', name: 'Alcohol hand rub' },
  { positionCode: 'A2', name: 'Ethyl alcohol 95%' },
  { positionCode: 'B1', name: 'Papanicolaou’s solution 1a (Harris hematoxylin)' },
  { positionCode: 'B1', name: 'Papanicolaou’s solution 2a (OG6)' },
  { positionCode: 'B1', name: 'Papanicolaou’s solution 3b (EA50)' },
  { positionCode: 'B2', name: 'Sodium acetate (anhydrous)' },
  { positionCode: 'B3', name: 'Acetic acid' },
  { positionCode: 'B3', name: 'Ethanol' },
  { positionCode: 'B3', name: 'Formic acid' },
  { positionCode: 'B4', name: 'Permount/Toluene solution' },
  { positionCode: 'B4', name: 'Propan-2-ol' },
  { positionCode: 'B4', name: 'Xylene' },
  { positionCode: 'C1', name: 'Formalin' },
  { positionCode: 'C2', name: 'Ammonia solution 25%' },
  { positionCode: 'C2', name: 'Ammonia solution 28%' },
  { positionCode: 'C2', name: 'Ammonia solution 30%' },
  { positionCode: 'C3', name: 'Acetonitrile' },
  { positionCode: 'C3', name: 'Dichloromethane' },
  { positionCode: 'C4', name: 'Hydrochloric acid 37%' },
  { positionCode: 'C4', name: 'Sulfuric acid' },
  { positionCode: 'C5', name: 'Citric acid' },
  { positionCode: 'C5', name: 'Trifluoroacetic acid' },
  { positionCode: 'T1', name: 'Wright’s Baso' },
  { positionCode: 'T2', name: 'Methanol' },
] as const satisfies readonly ChemicalPositionAssignment[]
