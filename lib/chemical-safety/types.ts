export type ChemicalWorkflowStatus = 'draft' | 'in_review' | 'approved' | 'superseded' | 'rejected'
export type ChemicalLifecycleStatus = 'active' | 'retired'
export type GhsPictogramCode = 'GHS01' | 'GHS02' | 'GHS03' | 'GHS04' | 'GHS05' | 'GHS06' | 'GHS07' | 'GHS08' | 'GHS09'
export type MeasuredUnit = 'mL' | 'L' | 'g' | 'kg'
/** หน่วยที่วัดได้ (mL/L/g/kg) หรือหน่วยนับจำนวนอิสระ เช่น 'test', 'kit' — ดู isMeasuredUnit/isQuantityUnit ใน domain.ts */
export type QuantityUnit = MeasuredUnit | string
export type SdsMatchStatus = 'candidate' | 'mismatch' | 'missing' | 'unsupported' | 'duplicate'
export type ChemicalStorageZoneCode = 'A' | 'B' | 'C' | 'T'
export type ChemicalStorageLocationKind = 'cabinet' | 'shelf' | 'table'
export type ChemicalStorageScope = 'room' | 'department'
/** Internal provenance only; both values are operationally usable. */
export type ChemicalWorkflowOrigin = 'current' | 'registry_v2'
export type ChemicalSdsDestination = 'room' | 'department'
export type ChemicalSdsPublicationStatus = 'unlinked' | 'ready' | 'active' | 'stale'
export type ChemicalPhysicalState = 'solid' | 'liquid' | 'gas' | 'mixture' | 'unknown'
export type ChemicalRole = 'custodian' | 'reviewer'
export type ChemicalChangeEntityType = 'product' | 'holding' | 'new_chemical' | 'department_chemical' | 'registry_entry' | 'holding_delete'
export type ChemicalSdsState = 'approved' | 'review_due' | 'draft' | 'mismatch' | 'missing'

export type JsonPrimitive = boolean | number | string | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface ChemicalRegistryFilters {
  q?: string
  unitId?: string
  roomId?: string
  positionCode?: string
  sdsStatus?: 'approved' | 'draft' | 'mismatch' | 'missing' | 'review_due'
  ghs?: GhsPictogramCode
  lifecycle?: ChemicalLifecycleStatus
}

export interface ChemicalRegistryRow {
  productId: string
  /** ต้องมีเพื่อสร้างคำขอแก้ไขคลัง (holding change request) ซึ่งอ้าง entityId เป็น holding.id */
  holdingId: string
  publicId: string
  canonicalName: string
  aliases: string[]
  casNumber: string | null
  concentration: string | null
  storageScope: ChemicalStorageScope
  workflowOrigin: ChemicalWorkflowOrigin
  roomId: string | null
  locationId: string | null
  packageValue: number | null
  packageUnit: QuantityUnit | null
  packageRaw: string | null
  currentContainerCount: number | null
  minimumStock: number | null
  lotNumber: string | null
  reportedTotalRaw: string | null
  calculatedTotalValue: number | null
  calculatedTotalUnit: QuantityUnit | null
  receivedOn: string | null
  openedOn: string | null
  expiresOn: string | null
  effectiveOn: string | null
  quantityConflict: boolean
  positionCode: string | null
  unitId: string
  unitName: string
  lifecycleStatus: ChemicalLifecycleStatus
  sdsStatus: string
  sdsWorkflowStatus?: ChemicalWorkflowStatus | null
  hasSdsFile: boolean
  sdsVersionId: string | null
  publicationStatus: ChemicalSdsPublicationStatus
  publicationDestination: ChemicalSdsDestination
  pictogramCodes: GhsPictogramCode[]
  signalWord: string | null
  hazards: Array<{ className: string; category: string }>
  hStatements: Array<{ code: string; text: string }>
  updatedAt: string
}

export interface ChemicalUnitDTO {
  id: string
  code: string
  nameTh: string
  active: boolean
  createdAt: string
}

export interface ChemicalRoomDTO {
  id: string
  code: string
  nameTh: string
  mapSpaceCode: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface ChemicalStorageLocationDTO {
  id: string
  roomId: string
  code: string
  zoneCode: ChemicalStorageZoneCode
  locationKind: ChemicalStorageLocationKind
  displayOrder: number
  displayGeometry: JsonValue | null
  active: boolean
}

export interface ChemicalStorageLocationDefinition {
  code: string
  zoneCode: ChemicalStorageZoneCode
  locationKind: ChemicalStorageLocationKind
  displayOrder: number
}

export interface ChemicalPositionAssignment {
  positionCode: string
  name: string
}

export interface ChemicalProductDTO {
  id: string
  publicId: string
  canonicalName: string
  casNumber: string | null
  manufacturer: string | null
  supplier: string | null
  productCode: string | null
  concentration: string | null
  physicalState: ChemicalPhysicalState | null
  lifecycleStatus: ChemicalLifecycleStatus
  ghsSourceText: string | null
  ghsPictogramCodes: GhsPictogramCode[]
  ghsHazardClasses: Array<{ classTh: string; classEn: string }>
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface ChemicalProductAliasDTO {
  id: string
  productId: string
  alias: string
  normalizedAlias: string
}

export interface ChemicalUnitProductDTO {
  productId: string
  unitId: string
  preferredName: string | null
  active: boolean
  publicEligible: boolean
}

export interface ChemicalHoldingDTO {
  id: string
  productId: string
  unitId: string
  storageScope: ChemicalStorageScope
  workflowOrigin: ChemicalWorkflowOrigin
  locationId: string | null
  lotNumber: string | null
  packageValue: number
  packageUnit: QuantityUnit
  currentContainerCount: number
  minimumStock: number
  reportedTotalRaw: string | null
  calculatedTotalValue: number | null
  calculatedTotalUnit: QuantityUnit | null
  receivedOn: string | null
  openedOn: string | null
  expiresOn: string | null
  effectiveOn: string | null
  approvedBy: string | null
  approvedAt: string | null
  updatedAt: string
}

export interface ChemicalSdsFileDTO {
  id: string
  sha256: string
  r2Key: string
  fileName: string
  contentType: string
  sizeBytes: number
  sourcePaths: string[]
  createdAt: string
}

export interface ChemicalStatementDTO {
  code: string
  text: string
}

export interface ChemicalSdsHazardDTO {
  id: string
  sdsVersionId: string
  hazardClass: string
  hazardCategory: string
}

export interface ChemicalSdsDTO {
  id: string
  productId: string
  sourceHoldingId: string | null
  linkedHoldingIds: string[]
  workflowOrigin: ChemicalWorkflowOrigin
  fileId: string | null
  sourceUrl: string | null
  fileUrl: string | null
  manufacturer: string | null
  supplier: string | null
  productCode: string | null
  concentration: string | null
  language: string | null
  revisionLabel: string | null
  effectiveOn: string | null
  reviewDueOn: string | null
  signalWord: string | null
  pictogramCodes: GhsPictogramCode[]
  hStatements: ChemicalStatementDTO[]
  pStatements: ChemicalStatementDTO[]
  storageInstructions: string | null
  incompatibilities: string | null
  emergencySummary: string | null
  status: ChemicalWorkflowStatus
  submittedBy: string | null
  submittedAt: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  reviewReason: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  hazards: ChemicalSdsHazardDTO[]
}

export interface ChemicalSdsPublicationDTO {
  id: string
  publicId: string
  productId: string
  unitId: string
  sourceHoldingId: string
  sdsVersionId: string
  destination: ChemicalSdsDestination
  departmentCode: string | null
  displayName: string
  status: Extract<ChemicalSdsPublicationStatus, 'active' | 'stale'>
  linkedBy: string | null
  linkedAt: string
  staleAt: string | null
}

export interface ChemicalRoleScopeDTO {
  userId: string
  unitId: string
  role: ChemicalRole
}

export interface ChemicalReviewDecisionDTO {
  status: 'approved' | 'rejected'
  reviewedBy: string
  reviewedAt: string
  reviewReason: string | null
}

export interface ChemicalChangeRequestDTO {
  id: string
  entityType: ChemicalChangeEntityType
  /** null ตอนคำขอยังไม่ได้สร้าง entity จริง เช่น new_chemical และ registry_entry */
  entityId: string | null
  unitId: string
  proposedData: Record<string, JsonValue>
  status: Exclude<ChemicalWorkflowStatus, 'superseded'>
  submittedBy: string | null
  submittedAt: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  reviewReason: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** ใช้แสดงในแผงรอทบทวนของหน้าทะเบียนสารเคมี — เติมชื่อสาร/หน่วยงานให้พร้อมแสดงผล */
export interface ChemicalChangeRequestListItemDTO extends ChemicalChangeRequestDTO {
  productName: string | null
  unitName: string
}

export interface ChemicalImportBatchDTO {
  id: string
  sourceKind: string
  sourceName: string
  sourcePath: string | null
  sourceSha256: string
  sourceR2Key: string | null
  parserVersion: string
  status: string
  summary: Record<string, JsonValue>
  importedBy: string | null
  createdAt: string
}

export interface ChemicalImportRowDTO {
  id: string
  batchId: string
  rowKey: string
  rawData: Record<string, JsonValue>
  normalizedData: Record<string, JsonValue> | null
  matchStatus: SdsMatchStatus
  conflictCodes: string[]
  targetProductId: string | null
  decisionNote: string | null
  decidedBy: string | null
  decidedAt: string | null
  createdAt: string
}
