import { z } from 'zod'

const uuid = z.string().uuid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const nullableDate = isoDate.nullable().optional()
// หน่วยที่วัดได้ (mL/L/g/kg) หรือหน่วยนับจำนวนอิสระ เช่น 'test', 'kit' — ดู isQuantityUnit ใน lib/chemical-safety/domain.ts
const quantityUnit = z.string().trim().min(1).max(20).regex(/^[\p{L}\p{N}.\-/ ]+$/u)
const pictogram = z.enum(['GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05', 'GHS06', 'GHS07', 'GHS08', 'GHS09'])
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()
const chemicalStorageScope = z.enum(['room', 'department'])

export const chemicalRegistryQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  unitId: uuid.optional(),
  roomId: uuid.optional(),
  positionCode: z.string().trim().max(20).optional(),
  sdsStatus: z.enum(['approved', 'draft', 'mismatch', 'missing', 'review_due']).optional(),
  ghs: pictogram.optional(),
  lifecycle: z.enum(['active', 'retired']).optional(),
})
export const chemicalRegistryFiltersSchema = chemicalRegistryQuerySchema

export const chemicalRegistryExportRequestSchema = z.object({
  format: z.enum(['pdf', 'xlsx']),
  filters: chemicalRegistryFiltersSchema.default({}),
  newChemicalHoldingIds: z.array(uuid).max(5000).default([]),
}).strict()

export const chemicalImportReviewQuerySchema = z.object({
  batchId: uuid.optional(),
  matchStatus: z.enum(['candidate', 'mismatch', 'missing', 'unsupported', 'duplicate']).optional(),
  q: z.string().trim().max(200).optional(),
})

export const internalSdsQuerySchema = z.object({
  productId: uuid.optional(),
  unitId: uuid.optional(),
  status: z.enum(['draft', 'in_review', 'approved', 'superseded', 'rejected']).optional(),
  q: z.string().trim().max(200).optional(),
})

const chemicalGhsHazardClassProposalSchema = z.object({
  classTh: z.string().trim().min(1).max(250),
  classEn: z.string().trim().min(1).max(250),
}).strict()

export const chemicalProductProposalSchema = z.object({
  canonicalName: z.string().trim().min(1).max(300),
  casNumber: z.string().trim().regex(/^\d{2,7}-\d{2}-\d$/).nullable().optional(),
  manufacturer: optionalText(300),
  supplier: optionalText(300),
  productCode: optionalText(150),
  concentration: optionalText(100),
  physicalState: z.enum(['solid', 'liquid', 'gas', 'mixture', 'unknown']).nullable().optional(),
  lifecycleStatus: z.enum(['active', 'retired']).default('active'),
  ghsSourceText: optionalText(2000),
  ghsPictogramCodes: z.array(pictogram).max(9).default([]),
  ghsHazardClasses: z.array(chemicalGhsHazardClassProposalSchema).max(20).default([]),
}).strict()

export const chemicalHoldingProposalSchema = z.object({
  productId: uuid,
  storageScope: chemicalStorageScope.default('room'),
  locationId: uuid.nullable().optional(),
  lotNumber: optionalText(150),
  packageValue: z.number().finite().nonnegative(),
  packageUnit: quantityUnit,
  currentContainerCount: z.number().int().nonnegative(),
  minimumStock: z.number().int().nonnegative(),
  reportedTotalRaw: optionalText(200),
  calculatedTotalValue: z.number().finite().nonnegative().nullable().optional(),
  calculatedTotalUnit: quantityUnit.nullable().optional(),
  receivedOn: nullableDate,
  openedOn: nullableDate,
  expiresOn: nullableDate,
  effectiveOn: nullableDate,
}).strict().superRefine((value, ctx) => {
  if (value.storageScope === 'room' && !value.locationId) {
    ctx.addIssue({ code: 'custom', path: ['locationId'], message: 'กรุณาเลือกตำแหน่งจัดเก็บ' })
  }
  if (value.storageScope === 'department' && value.locationId) {
    ctx.addIssue({ code: 'custom', path: ['locationId'], message: 'สารของงานห้ามระบุตำแหน่งจัดเก็บ' })
  }
})

// สร้างสารเคมีใหม่ทั้งชุด (product + holding) ในคำขอเดียว — ไม่มี productId เพราะยังไม่มีจริง
export const chemicalNewChemicalProposalSchema = z.object({
  canonicalName: z.string().trim().min(1).max(300),
  aliases: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
  casNumber: z.string().trim().regex(/^\d{2,7}-\d{2}-\d$/).nullable().optional(),
  manufacturer: optionalText(300),
  supplier: optionalText(300),
  productCode: optionalText(150),
  concentration: optionalText(100),
  physicalState: z.enum(['solid', 'liquid', 'gas', 'mixture', 'unknown']).nullable().optional(),
  locationId: uuid,
  lotNumber: optionalText(150),
  packageValue: z.number().finite().nonnegative(),
  packageUnit: quantityUnit,
  currentContainerCount: z.number().int().nonnegative(),
  minimumStock: z.number().int().nonnegative(),
  reportedTotalRaw: optionalText(200),
  calculatedTotalValue: z.number().finite().nonnegative().nullable().optional(),
  calculatedTotalUnit: quantityUnit.nullable().optional(),
  receivedOn: nullableDate,
  openedOn: nullableDate,
  expiresOn: nullableDate,
  effectiveOn: nullableDate,
  ghsSourceText: optionalText(2000),
  ghsPictogramCodes: z.array(pictogram).max(9).default([]),
  ghsHazardClasses: z.array(chemicalGhsHazardClassProposalSchema).max(20).default([]),
}).strict()

export const chemicalDepartmentChemicalProposalSchema = z.object({
  productId: uuid.nullable().optional(),
  sourceDepartmentSdsId: uuid,
  canonicalName: z.string().trim().min(1).max(300),
  aliases: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
  casNumber: z.string().trim().regex(/^\d{2,7}-\d{2}-\d$/).nullable().optional(),
  manufacturer: optionalText(300),
  supplier: optionalText(300),
  productCode: optionalText(150),
  concentration: optionalText(100),
  physicalState: z.enum(['solid', 'liquid', 'gas', 'mixture', 'unknown']).nullable().optional(),
  storageScope: z.literal('department'),
  locationId: z.null().optional(),
  lotNumber: optionalText(150),
  packageValue: z.number().finite().nonnegative(),
  packageUnit: quantityUnit,
  currentContainerCount: z.number().int().nonnegative(),
  minimumStock: z.number().int().nonnegative(),
  reportedTotalRaw: optionalText(200),
  calculatedTotalValue: z.number().finite().nonnegative().nullable().optional(),
  calculatedTotalUnit: quantityUnit.nullable().optional(),
  receivedOn: nullableDate,
  openedOn: nullableDate,
  expiresOn: nullableDate,
  effectiveOn: nullableDate,
  ghsSourceText: optionalText(2000),
  ghsPictogramCodes: z.array(pictogram).max(9).default([]),
  ghsHazardClasses: z.array(chemicalGhsHazardClassProposalSchema).max(20).default([]),
}).strict()

const chemicalRegistryHoldingShape = {
  storageScope: chemicalStorageScope,
  locationId: uuid.nullable().optional(),
  lotNumber: optionalText(150),
  packageValue: z.number().finite().nonnegative(),
  packageUnit: quantityUnit,
  currentContainerCount: z.number().int().nonnegative(),
  minimumStock: z.number().int().nonnegative(),
  reportedTotalRaw: optionalText(200),
  calculatedTotalValue: z.number().finite().nonnegative().nullable().optional(),
  calculatedTotalUnit: quantityUnit.nullable().optional(),
  receivedOn: nullableDate,
  openedOn: nullableDate,
  expiresOn: nullableDate,
  effectiveOn: nullableDate,
}

function validateRegistryPlacement(value: { storageScope: 'room' | 'department'; locationId?: string | null }, ctx: z.RefinementCtx) {
  if (value.storageScope === 'room' && !value.locationId) {
    ctx.addIssue({ code: 'custom', path: ['locationId'], message: 'กรุณาเลือกตำแหน่งจัดเก็บ' })
  }
  if (value.storageScope === 'department' && value.locationId) {
    ctx.addIssue({ code: 'custom', path: ['locationId'], message: 'สารของงานห้ามระบุตำแหน่งจัดเก็บ' })
  }
}

export const chemicalRegistryEntryProposalSchema = z.discriminatedUnion('productMode', [
  z.object({
    productMode: z.literal('existing'),
    productId: uuid,
    ...chemicalRegistryHoldingShape,
  }).strict(),
  z.object({
    productMode: z.literal('new'),
    canonicalName: z.string().trim().min(1).max(300),
    aliases: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
    casNumber: z.string().trim().regex(/^\d{2,7}-\d{2}-\d$/).nullable().optional(),
    manufacturer: optionalText(300),
    supplier: optionalText(300),
    productCode: optionalText(150),
    concentration: optionalText(100),
    physicalState: z.enum(['solid', 'liquid', 'gas', 'mixture', 'unknown']).nullable().optional(),
    ghsSourceText: optionalText(2000),
    ghsPictogramCodes: z.array(pictogram).max(9).default([]),
    ghsHazardClasses: z.array(chemicalGhsHazardClassProposalSchema).max(20).default([]),
    ...chemicalRegistryHoldingShape,
  }).strict(),
]).superRefine(validateRegistryPlacement)

// ลบ holding เดิม — ไม่มีฟิลด์ให้แก้ไข มีแค่เหตุผลไว้ให้ผู้ทบทวนอ่านประกอบก่อนอนุมัติ
export const chemicalHoldingDeleteProposalSchema = z.object({
  reason: optionalText(500),
}).strict()

export const chemicalChangeRequestSchema = z.discriminatedUnion('entityType', [
  z.object({ entityType: z.literal('product'), entityId: uuid, unitId: uuid, proposedData: chemicalProductProposalSchema }).strict(),
  z.object({ entityType: z.literal('holding'), entityId: uuid, unitId: uuid, proposedData: chemicalHoldingProposalSchema }).strict(),
  z.object({ entityType: z.literal('new_chemical'), unitId: uuid, proposedData: chemicalNewChemicalProposalSchema }).strict(),
  z.object({ entityType: z.literal('department_chemical'), unitId: uuid, proposedData: chemicalDepartmentChemicalProposalSchema }).strict(),
  z.object({ entityType: z.literal('registry_entry'), unitId: uuid, proposedData: chemicalRegistryEntryProposalSchema }).strict(),
  z.object({ entityType: z.literal('holding_delete'), entityId: uuid, unitId: uuid, proposedData: chemicalHoldingDeleteProposalSchema }).strict(),
])

export const chemicalChangeDraftPatchSchema = z.object({
  proposedData: z.record(z.unknown()),
  updatedAt: z.string().datetime(),
}).strict()

const statementSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^H\d{3}[A-Z]{0,2}$/),
  text: z.string().trim().min(1).max(1000),
}).strict()
const precautionSchema = z.object({
  code: z.preprocess(
    value => typeof value === 'string' ? value.trim().toUpperCase().replace(/\s+/g, '') : value,
    z.string().regex(/^P\d{3}(?:\+P?\d{3})*$/),
  ),
  text: z.string().trim().min(1).max(1000),
}).strict()
const hazardSchema = z.object({
  className: z.string().trim().min(1).max(250),
  category: z.string().trim().min(1).max(100),
}).strict()

const chemicalSdsMetadataShape = {
  productId: uuid,
  unitId: uuid,
  manufacturer: optionalText(300),
  supplier: optionalText(300),
  productCode: optionalText(150),
  concentration: optionalText(100),
  language: z.string().trim().min(2).max(30),
  revisionLabel: optionalText(100),
  effectiveOn: nullableDate,
  reviewDueOn: nullableDate,
  signalWord: z.enum(['Danger', 'Warning', 'อันตราย', 'คำเตือน']).nullable().optional(),
  pictogramCodes: z.array(pictogram).max(9).default([]),
  hazards: z.array(hazardSchema).max(100).default([]),
  hStatements: z.array(statementSchema).max(100).default([]),
  pStatements: z.array(precautionSchema).max(100).default([]),
  storageInstructions: optionalText(4000),
  incompatibilities: optionalText(4000),
  emergencySummary: optionalText(4000),
}

function requireHazardRows(value: {
  pictogramCodes: unknown[]
  hStatements: unknown[]
  pStatements: unknown[]
  hazards: unknown[]
}, ctx: z.RefinementCtx) {
  const hasStructured = value.pictogramCodes.length > 0 || value.hStatements.length > 0 || value.pStatements.length > 0
  if (hasStructured && value.hazards.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['hazards'], message: 'กรุณาระบุประเภทและหมวดความเป็นอันตรายจาก SDS หมวด 2' })
  }
}

export const chemicalSdsMetadataSchema = z.object(chemicalSdsMetadataShape).strict().superRefine(requireHazardRows)

// สร้างฉบับร่างเปล่า — รายละเอียด GHS มากรอกทีหลังผ่าน PATCH
export const chemicalSdsCreateSchema = z.object({
  holdingId: uuid,
  language: z.string().trim().min(2).max(30).default('th'),
  revisionLabel: optionalText(100),
}).strict()

export const chemicalSdsPublicationSchema = z.object({
  sdsVersionId: uuid,
}).strict()

// แก้ฉบับร่าง — productId/unitId ไม่ต้องส่ง เพราะ route หาเองจาก id ของฉบับร่าง
// updatedAt คือ optimistic lock ที่ RPC ใช้ตรวจว่าไม่มีใครแก้แทรกระหว่างที่เปิดฟอร์มค้างไว้
const { productId: _productId, unitId: _unitId, ...chemicalSdsEditableShape } = chemicalSdsMetadataShape

export const chemicalSdsDraftPatchSchema = z.object({
  ...chemicalSdsEditableShape,
  updatedAt: z.string().datetime({ offset: true }),
  fileId: uuid.nullable().optional(),
}).strict().superRefine(requireHazardRows)

export const chemicalRoleScopeSchema = z.object({
  userId: uuid,
  unitId: uuid,
  role: z.enum(['custodian', 'reviewer']),
  enabled: z.boolean(),
}).strict()

export const chemicalSubmitSchema = z.object({ updatedAt: z.string().datetime().optional() }).strict()

export const chemicalReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(1000).default(''),
}).strict().superRefine((value, ctx) => {
  if (value.decision === 'rejected' && !value.reason) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: 'กรุณาระบุเหตุผลที่ไม่อนุมัติ' })
  }
})

export const chemicalSdsFinalizeSchema = z.object({
  ...chemicalSdsMetadataShape,
  key: z.string().trim().min(1).max(1000),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.literal('application/pdf'),
  sizeBytes: z.number().int().min(1_000_000).max(50_000_000),
}).strict().superRefine(requireHazardRows)

export type ImportReviewFilters = z.infer<typeof chemicalImportReviewQuerySchema>
export type InternalSdsFilters = z.infer<typeof internalSdsQuerySchema>
