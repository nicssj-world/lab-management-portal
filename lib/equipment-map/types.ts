import type { Equipment } from '@/lib/queries/equipment'
import type { PmCalDueState } from '@/lib/equipment/pm-cal-due'

/** รูปทรงบนผังเครื่องมือ — ผังต้นฉบับเป็นสี่เหลี่ยมล้วน จึงรองรับแค่ rect */
export interface EquipmentRect {
  x: number
  y: number
  width: number
  height: number
}

export interface EquipmentPoint {
  x: number
  y: number
}

export interface EquipmentAreaLabel {
  x: number
  y: number
  lines: readonly string[]
  fontSize: number
}

export interface EquipmentWallDefinition {
  code: string
  /** SVG path data (M/H/V/L แบบ absolute) ในระบบพิกัดเดียวกับ EQUIPMENT_MAP_VIEW_BOX */
  d: string
}

/** สัญลักษณ์ประตูบนผังต้นฉบับ — วาดทับช่องเปิดของแนวผนัง */
export interface EquipmentDoorDefinition {
  code: string
  x: number
  y: number
  orientation: 'horizontal' | 'vertical'
  length: number
}

export interface EquipmentAreaDefinition {
  code: string
  nameTh: string
  kind: 'room' | 'zone'
  /** เฉพาะ kind: 'zone' — ต้องชี้ไปยัง area ที่เป็น kind: 'room' */
  parentCode?: string
  /** พิกัดจากไฟล์ต้นฉบับ แผนผังกลุ่มงาน2569.pptx (ดูหมายเหตุใน manifest.ts) */
  rect: EquipmentRect
  /** รูปทรงจริงเมื่อพื้นที่ไม่ใช่สี่เหลี่ยม; rect ยังคงเป็นกรอบครอบสำหรับป้าย/ซูม */
  polygon?: readonly EquipmentPoint[]
  /** ไม่มีเมื่อพื้นที่ต้องคงไว้เพื่อผูกข้อมูล แต่ไม่ต้องแสดงป้ายบนผัง */
  label?: EquipmentAreaLabel
  /** สีพื้นหลังที่กำหนดเฉพาะพื้นที่; ปล่อยว่างจะใช้ตามชนิดห้อง/โซน */
  fillTone?: 'room' | 'controlled'
}

export interface EquipmentAreaCounts {
  total: number
  active: number
  broken: number
  dueSoon: number
  overdue: number
  pendingReg: number
  unsurveyed: number
}

/**
 * เครื่องมือชิ้นหนึ่งที่ถูก "กำหนดพื้นที่" แล้ว (area_code ไม่ว่าง) — ไม่ได้แปลว่าปักหมุดแล้วเสมอไป
 * x/y เป็น null ได้ (กำหนดโซนไว้ก่อน ยังไม่ปักหมุดจริง) — ต้องเช็ก `placed` ก่อนวาดบนแคนวาส
 * รายการ/ตัวนับของห้อง/โซนต้องนับรวมทั้งสองแบบ ไม่ใช่แค่ที่ปักหมุดแล้ว (ไม่งั้นกำหนดโซนแล้วจะดู "หายไป")
 */
export interface EquipmentPinDTO {
  id: string
  code: string | null
  name: string
  department: string
  /** classification จากทะเบียน ใช้เลือกรูปทรงของหมุดบนผัง */
  classification: string | null
  areaCode: string
  x: number | null
  y: number | null
  /** มุมของสัญลักษณ์บนแผนที่ (หมุนได้ทีละ 90°) */
  rotation: 0 | 90 | 180 | 270
  /** true เมื่อมีทั้ง x และ y — เท่ากับ map_x/map_y ไม่ว่างทั้งคู่ */
  placed: boolean
  status: Equipment['status']
  riskLevel: Equipment['risk_level']
  /** cbh_code_pending || hospital_asset_no_pending */
  pendingRegistration: boolean
  due: PmCalDueState
  /** มี record ในรอบสำรวจที่เปิดอยู่หรือไม่ — false เสมอถ้าไม่มีรอบเปิดอยู่ */
  surveyed: boolean
  responsiblePerson: string | null
}

/**
 * รายงานกลาง "ยังไม่ปักหมุด" — ทุกเครื่องมือที่ไม่มีพิกัด (ไม่ว่าจะกำหนดพื้นที่ไว้แล้วหรือไม่)
 * ใช้ทยอยจัดข้อมูลเก่า: ชิ้นที่กำหนดโซนไว้แล้วจะโผล่ทั้งในรายงานนี้ (areaCode ไม่ null) และในรายการของโซนนั้นเอง
 */
export interface EquipmentUnplacedDTO {
  id: string
  code: string | null
  name: string
  department: string
  classification: string | null
  needsCalibration: boolean
  areaCode: string | null
}

export interface EquipmentAreaDTO {
  code: string
  nameTh: string
  kind: 'room' | 'zone'
  parentCode: string | null
  /** null เฉพาะพื้นที่นอกผัง (hasGeometry: false) ที่สร้างเพิ่มเองผ่าน POST /api/admin/equipment/areas */
  rect: EquipmentRect | null
  polygon: readonly EquipmentPoint[] | null
  /** null สำหรับพื้นที่นอกผัง — ไม่มีป้ายให้วาดบนแผนที่ */
  label: EquipmentAreaLabel | null
  fillTone: 'room' | 'controlled' | null
  hasGeometry: boolean
  isActive: boolean
  counts: EquipmentAreaCounts
}

export interface EquipmentActiveRoundDTO {
  id: string
  nameTh: string
  startedAt: string
}

export interface EquipmentMapDTO {
  version: string
  viewBox: string
  walls: readonly EquipmentWallDefinition[]
  doors: readonly EquipmentDoorDefinition[]
  areas: readonly EquipmentAreaDTO[]
  pins: readonly EquipmentPinDTO[]
  unplaced: readonly EquipmentUnplacedDTO[]
  activeRound: EquipmentActiveRoundDTO | null
}
