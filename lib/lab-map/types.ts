export type InfectionClass = 'infectious' | 'clean' | 'risk'

export type AccessPointStatus =
  | 'open'
  | 'fingerprint_controlled'
  | 'permanently_locked'

/** โหมดแผนที่ — ทางหนีไฟและอุปกรณ์ความปลอดภัยเป็นคนละชั้นข้อมูล */
export type MapMode = 'overview' | 'infection' | 'safety' | 'safety-assets'

export type RouteKind = 'visitor' | 'staff_orientation' | 'evacuation'

export type RouteVariant = 'primary' | 'alternate'

export type SvgShape =
  | { type: 'rect'; x: number; y: number; width: number; height: number; rx?: number }
  | { type: 'polygon'; points: ReadonlyArray<readonly [number, number]> }
  | { type: 'path'; d: string }

/**
 * ชั้นโครงสร้าง — ผนัง ประตู แนวกั้นจุดสแกน บันได ลิฟต์
 * วาดครั้งเดียวและไม่ถูกสร้างขึ้นใหม่จากสี่เหลี่ยมของห้อง
 * ทำให้ห้องซ้อนในห้อง และแนวกั้นที่ไม่ใช่ผนัง แสดงได้โดยไม่ต้องสร้างห้องปลอม
 */
export type LabStructureKind =
  | 'exterior-wall'
  | 'wall'
  | 'partition'
  | 'threshold'
  | 'door-swing'
  | 'door-leaf'
  | 'scanner-barrier'

export interface LabStructureDefinition {
  code: string
  kind: LabStructureKind
  /** SVG path data ในระบบพิกัดเดียวกับ viewBox */
  d: string
}

/** ป้ายชื่อกำหนดเอง — ไม่ได้เกิดจากการตัดคำอัตโนมัติของชื่อห้อง */
export interface LabLabelDefinition {
  code: string
  /** ผูกกับห้องเพื่อไฮไลต์พร้อมกัน — ป้ายอิสระ (เช่น ป้ายทางหนีไฟ) ไม่ต้องมี */
  spaceCode?: string
  x: number
  y: number
  lines: readonly string[]
  fontSize: number
  /** องศาการหมุนรอบจุด (x, y) */
  rotate?: number
  emphasis?: boolean
}

export interface LabSpaceDefinition {
  code: string
  nameTh: string
  nameEn?: string
  shape: SvgShape
  infectionClass: InfectionClass
  workUnits: readonly string[]
  controlled: boolean
  /** รหัสห้องแม่ เมื่อห้องนี้อยู่ซ้อนภายในอีกห้องหนึ่งจริงตามผัง */
  nestedIn?: string
}

export interface LabZoneDefinition {
  code: string
  nameTh: string
  spaceCodes: readonly string[]
  workUnits: readonly string[]
}

export interface LabAccessPointDefinition {
  code: string
  nameTh: string
  kind: 'fingerprint' | 'door' | 'exit'
  status: AccessPointStatus
  x: number
  y: number
}

/**
 * 'installation' = จุดติดตั้งป้ายจริง (เข้าแคตตาล็อกงานพิมพ์)
 * 'checkpoint' = จุดสแกนนิ้วมือที่ผู้มาติดต่อยืนรอ — ใช้เป็นจุดเริ่มต้นของแผนหนีไฟให้ตรงตำแหน่งจริง
 * ไม่ใช่จุดติดตั้งป้าย จึงไม่เข้าแคตตาล็อกงานพิมพ์
 */
export type LabStationKind = 'installation' | 'checkpoint'

export interface LabStationDefinition {
  code: string
  nameTh: string
  kind: LabStationKind
  x: number
  y: number
  /** จุดสแกนที่สถานีนี้ผูกอยู่ — ใช้เลือกสถานีเริ่มต้นให้ผู้มาติดต่อผ่าน stationForCheckpoint */
  checkpointCode?: string
}

export type SafetyEquipmentKind =
  | 'fire-extinguisher'
  | 'fire-hose'
  | 'manual-call-point'
  | 'aed'
  | 'first-aid-kit'
  | 'eyewash'
  | 'nss-eyewash'
  | 'emergency-shower'
  | 'spill-kit'
  | 'emergency-shutoff'

export interface LabSafetyEquipmentDefinition {
  code: string
  kind: SafetyEquipmentKind
  nameTh: string
  x: number
  y: number
  /** false = ตำแหน่งประมาณจากผังหนีไฟฉบับเก่า ยังไม่ได้ยืนยันหน้างาน */
  verified: boolean
  /** จุดอ้างอิงบนผังฉบับเก่า ใช้ตอนเดินตรวจยืนยัน */
  sourceNoteTh?: string
  shutoffFor?: 'electricity' | 'gas' | null
  operationalStatus?: 'unverified' | 'verified' | 'passed' | 'needs_attention' | 'failed' | 'overdue' | 'due_soon'
}

export type LabPointType = 'assembly' | 'safe'

export interface LabAssemblyPointDefinition {
  code: string
  nameTh: string
  detailTh?: string
  /** Legacy snapshots may omit this field; omitted values are treated as assembly points. */
  pointType?: LabPointType
  exitCodes: readonly string[]
  latitude?: number | null
  longitude?: number | null
  verified?: boolean
}

export interface SafetyInspectionDTO {
  id: string
  assetId: string
  result: 'passed' | 'needs_attention' | 'failed' | 'not_found'
  inspectedOn: string
  nextInspectionDate: string | null
  expiresOn: string | null
  note: string | null
  photoUrl: string | null
  inspectedBy: string
  inspectorName: string | null
  createdAt: string
}

export interface SafetyAssetDTO extends LabSafetyEquipmentDefinition {
  id: string
  spaceCode: string | null
  department: string | null
  positionStatus: 'unverified' | 'verified'
  lifecycleStatus: 'active' | 'retired'
  inspectionProfile: 'biohazard_spill_kit' | 'chemical_spill_kit' | 'nss_eyewash' | null
  activatedOn: string
  positionVerifiedBy: string | null
  positionVerifiedAt: string | null
  createdAt: string
  updatedAt: string
  latestInspection: SafetyInspectionDTO | null
}

export interface SafetyInspectionFilters {
  query: string
  status: string
  kind: string
  spaceCode: string
}

export interface SafetyInspectionQueueItem {
  asset: SafetyAssetDTO
  completed: boolean
  sequence: number
}

export interface SafetyInspectionQueue {
  items: readonly SafetyInspectionQueueItem[]
  progress: { completed: number; total: number; remaining: number }
}

export interface SafetyInspectionRoundItemDTO {
  id: string
  assetId: string
  sequence: number
  status: 'pending' | 'completed' | 'skipped'
  inspectionId: string | null
}

export interface SafetyInspectionRoundDTO {
  id: string
  nameTh: string
  status: 'open' | 'closed'
  filters: SafetyInspectionFilters
  startedAt: string
  items: readonly SafetyInspectionRoundItemDTO[]
}

export interface SafetyChecklistTemplateItem {
  key: string
  labelTh: string
  required: boolean
}

export interface SafetyChecklistAnswer {
  key: string
  labelTh: string
  answer: 'pass' | 'fail' | 'na'
  note?: string | null
}

export interface AssemblyPointVerificationDTO {
  id: string
  assemblyPointId: string
  latitude: number
  longitude: number
  accuracyMeters: number | null
  note: string | null
  photoUrl: string
  verifiedBy: string
  verifierName: string | null
  verifiedAt: string
}

export interface AssemblyPointDTO extends LabAssemblyPointDefinition {
  id: string
  positionStatus: 'unverified' | 'verified'
  lifecycleStatus: 'active' | 'retired'
  positionVerifiedBy: string | null
  positionVerifiedAt: string | null
  createdAt: string
  updatedAt: string
  latestVerification: AssemblyPointVerificationDTO | null
}

export interface LabRoutePreset {
  code: string
  kind: RouteKind
  variant: RouteVariant
  fromStationCode: string
  destinationCode: string
  pointCodes: readonly string[]
  polyline: ReadonlyArray<readonly [number, number]>
  directionsTh: readonly string[]
}

export interface LabMapSpaceDTO extends Omit<LabSpaceDefinition, 'infectionClass'> {
  infectionClass?: InfectionClass
}

export interface LabMapDTO {
  version: string
  releaseStatus?: 'published' | 'draft'
  viewBox: string
  stationCode: string
  structures: readonly LabStructureDefinition[]
  spaces: readonly LabMapSpaceDTO[]
  labels: readonly LabLabelDefinition[]
  zones: readonly LabZoneDefinition[]
  accessPoints: readonly LabAccessPointDefinition[]
  stations: readonly LabStationDefinition[]
  routes: readonly LabRoutePreset[]
  safetyEquipment: readonly LabSafetyEquipmentDefinition[]
  assemblyPoints: readonly LabAssemblyPointDefinition[]
}

export interface RoutePresetLookup {
  kind: RouteKind
  stationCode: string
  destinationCode: string
  variant?: RouteVariant
}

export type StaffLabMapDTO = LabMapDTO

export type MapReleaseStatus = 'draft' | 'published' | 'retired'

export interface MapReleaseDTO {
  id?: string
  versionCode: string
  status: MapReleaseStatus
  manifestHash: string
  effectiveDate: string | null
  reviewedBy: string | null
  approvedBy: string | null
  approvedAt: string | null
  reviewerName?: string | null
  approverName?: string | null
  notes?: string | null
  assetSnapshot?: readonly LabSafetyEquipmentDefinition[]
  assemblyPointSnapshot?: readonly LabAssemblyPointDefinition[]
}
