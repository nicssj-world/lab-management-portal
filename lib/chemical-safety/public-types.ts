import type { GhsPictogramCode } from './types'

/** ที่มาของสัญลักษณ์ GHS — ต้องบอกผู้อ่านเสมอว่าข้อมูลมาจากไหน */
export type PublicGhsSource = 'sds' | 'masterlist'

/**
 * pending = สารอยู่ในทะเบียนและมีการจำแนก GHS แล้ว แต่เอกสาร SDS ยังไม่ผ่านการทบทวน
 * จึงยังไม่มีไฟล์ให้เปิด (viewUrl/downloadUrl เป็น null)
 */
export type PublicSdsStatus = 'approved' | 'pending'

export interface PublicSdsResult {
  publicId: string
  canonicalName: string
  aliases: string[]
  casNumber: string | null
  concentration: string | null
  manufacturer: string | null
  supplier: string | null
  productCode: string | null
  units: Array<{ code: string; name: string }>
  language: string
  revisionLabel: string | null
  effectiveOn: string | null
  signalWord: string | null
  pictogramCodes: GhsPictogramCode[]
  ghsSource: PublicGhsSource
  /** คำจำแนกภาษาไทยจาก master list — ใช้แสดงเมื่อยังไม่มี H-code จาก SDS */
  hazardClassesTh: string[]
  hCodes: string[]
  hazardStatements: Array<{ code: string; text: string }>
  sourceUrl: string | null
  sdsStatus: PublicSdsStatus
  positionCode: string | null
  zoneCode: string | null
  /** null เมื่อ sdsStatus เป็น pending — client ต้องเช็คก่อนแสดงปุ่ม */
  viewUrl: string | null
  downloadUrl: string | null
}

export interface PublicSdsFile {
  r2Key: string
  fileName: string
  contentType: 'application/pdf'
}

export interface PublicSdsFilters {
  q?: string
  unit?: string
  language?: string
  ghs?: GhsPictogramCode
  zone?: string
  position?: string
  productIds?: string[]
}

// ── ผังการจัดเก็บสำหรับหน้าสาธารณะ ──────────────────────────────────────────
// แสดงตำแหน่งตู้และชื่อสาร แต่ไม่เปิดเผยปริมาณคงคลัง lot หรือขั้นต่ำ
export interface PublicStorageCabinet {
  code: string
  zoneCode: string
  locationKind: string
  displayOrder: number
  chemicals: Array<{
    publicId: string
    name: string
    pictogramCodes: GhsPictogramCode[]
  }>
}

export interface PublicStorageZone {
  code: string
  titleTh: string
  color: string
  displayRow: number
  cabinets: PublicStorageCabinet[]
}

export interface PublicStorageLayout {
  roomNameTh: string
  updatedLabel: string
  zones: PublicStorageZone[]
  groupSummary: Array<{ groupTh: string; locationCodes: string[] }>
}

// ── คลังเอกสาร SDS แยกตามงาน ────────────────────────────────────────────────
export interface PublicDepartmentSdsItem {
  publicId: string
  displayName: string
}

export interface PublicDepartmentSdsGroup {
  code: string
  department: string
  items: PublicDepartmentSdsItem[]
}
