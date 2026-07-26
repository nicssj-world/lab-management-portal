import { z } from 'zod'

const uuid = z.string().uuid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const nullableDate = isoDate.nullable().optional()
const quantityUnit = z.enum(['mL', 'L', 'g', 'kg'])
const pictogram = z.enum(['GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05', 'GHS06', 'GHS07', 'GHS08', 'GHS09'])
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()

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

export const chemicalProductProposalSchema = z.object({
  canonicalName: z.string().trim().min(1).max(300),
  aliases: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
  casNumber: z.string().trim().regex(/^\d{2,7}-\d{2}-\d$/).nullable().optional(),
  manufacturer: optionalText(300),
  supplier: optionalText(300),
  productCode: optionalText(150),
  concentration: optionalText(100),
  physicalState: z.enum(['solid', 'liquid', 'gas', 'mixture', 'unknown']).nullable().optional(),
  lifecycleStatus: z.enum(['active', 'retired']).default('active'),
}).strict()

export const chemicalHoldingProposalSchema = z.object({
  productId: uuid,
  locationId: uuid,
  lotNumber: optionalText(150),
  packageValue: z.number().finite().nonnegative(),
  packageUnit: quantityUnit,
  currentContainerCount: z.number().int().nonnegative(),
  minimumStock: z.number().int().nonnegative(),
  reportedTotalRaw: optionalText(200),
  receivedOn: nullableDate,
  openedOn: nullableDate,
  expiresOn: nullableDate,
  effectiveOn: nullableDate,
}).strict()

export const chemicalChangeRequestSchema = z.discriminatedUnion('entityType', [
  z.object({ entityType: z.literal('product'), entityId: uuid, unitId: uuid, proposedData: chemicalProductProposalSchema }).strict(),
  z.object({ entityType: z.literal('holding'), entityId: uuid, unitId: uuid, proposedData: chemicalHoldingProposalSchema }).strict(),
])

export const chemicalChangeDraftPatchSchema = z.object({
  proposedData: z.record(z.unknown()),
  updatedAt: z.string().datetime(),
}).strict()

const statementSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^H\d{3}[A-Z]?$/),
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
