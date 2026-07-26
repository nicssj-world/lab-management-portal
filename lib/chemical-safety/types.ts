export type ChemicalWorkflowStatus = 'draft' | 'in_review' | 'approved' | 'superseded' | 'rejected'
export type ChemicalLifecycleStatus = 'active' | 'retired'
export type GhsPictogramCode = 'GHS01' | 'GHS02' | 'GHS03' | 'GHS04' | 'GHS05' | 'GHS06' | 'GHS07' | 'GHS08' | 'GHS09'
export type QuantityUnit = 'mL' | 'L' | 'g' | 'kg'
export type SdsMatchStatus = 'candidate' | 'mismatch' | 'missing' | 'unsupported' | 'duplicate'
export type ChemicalStorageZoneCode = 'A' | 'B' | 'C' | 'T'
export type ChemicalStorageLocationKind = 'cabinet' | 'shelf' | 'table'
export type ChemicalPhysicalState = 'solid' | 'liquid' | 'gas' | 'mixture' | 'unknown'
export type ChemicalRole = 'custodian' | 'reviewer'
export type ChemicalChangeEntityType = 'product' | 'holding'
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
  publicId: string
  canonicalName: string
  aliases: string[]
  casNumber: string | null
  concentration: string | null
  packageValue: number | null
  packageUnit: QuantityUnit | null
  currentContainerCount: number | null
  minimumStock: number | null
  reportedTotalRaw: string | null
  calculatedTotalValue: number | null
  calculatedTotalUnit: QuantityUnit | null
  quantityConflict: boolean
  positionCode: string | null
  unitId: string
  unitName: string
  sdsStatus: string
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
  locationId: string
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
  entityId: string
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
