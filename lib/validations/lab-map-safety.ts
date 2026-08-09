import { z } from 'zod'
import { SAFETY_EQUIPMENT_KINDS } from '@/lib/lab-map/safety-domain'

const optionalText = z.string().trim().max(2000).nullish()
const immutableCode = z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const safetyAssetBaseSchema = z.object({
  code: immutableCode,
  nameTh: z.string().trim().min(1).max(200),
  kind: z.enum(SAFETY_EQUIPMENT_KINDS),
  x: z.number().min(0).max(1477),
  y: z.number().min(0).max(892),
  spaceCode: z.string().trim().min(1).max(80).nullish(),
  department: z.string().trim().min(1).max(160).nullish(),
  shutoffFor: z.enum(['electricity', 'gas']).nullish(),
  sourceNoteTh: optionalText,
})

function validateShutoff(
  value: { kind?: string; shutoffFor?: 'electricity' | 'gas' | null },
  context: z.RefinementCtx,
) {
  if (value.kind === 'emergency-shutoff' && !value.shutoffFor) {
    context.addIssue({ code: 'custom', path: ['shutoffFor'], message: 'ต้องระบุว่าเป็นจุดตัดไฟหรือก๊าซ' })
  }
  if (value.kind !== 'emergency-shutoff' && value.shutoffFor) {
    context.addIssue({ code: 'custom', path: ['shutoffFor'], message: 'ใช้ได้เฉพาะจุดตัดฉุกเฉิน' })
  }
}

export const safetyAssetInputSchema = safetyAssetBaseSchema.superRefine(validateShutoff)

export const safetyAssetPatchSchema = safetyAssetBaseSchema.omit({ code: true }).partial().extend({
  updatedAt: z.string().datetime({ offset: true }),
  retire: z.boolean().optional(),
}).superRefine(validateShutoff)

export const safetyAssetPositionSchema = z.object({
  x: z.number().min(0).max(1477),
  y: z.number().min(0).max(892),
  spaceCode: z.string().trim().min(1).max(80).nullable(),
  updatedAt: z.string().datetime({ offset: true }),
})

export const safetyInspectionFiltersSchema = z.object({
  query: z.string().max(200),
  status: z.string().max(40),
  kind: z.string().max(40),
  spaceCode: z.string().max(80),
})

export const safetyInspectionRoundInputSchema = z.object({
  nameTh: z.string().trim().min(1).max(200),
  filters: safetyInspectionFiltersSchema,
  orderedAssetIds: z.array(z.string().uuid()).min(1).max(1000)
    .refine(ids => new Set(ids).size === ids.length, 'อุปกรณ์ในรอบตรวจต้องไม่ซ้ำ'),
})

export const safetyChecklistAnswerSchema = z.object({
  key: z.string().min(1).max(80),
  labelTh: z.string().min(1).max(200),
  answer: z.enum(['pass', 'fail', 'na']),
  note: z.string().max(1000).nullish(),
})

export const inspectionFinalizeSchema = z.object({
  key: z.string().min(1),
  fileName: z.string().min(1).max(255),
  result: z.enum(['passed', 'needs_attention', 'failed', 'not_found']),
  inspectedOn: isoDate,
  nextInspectionDate: isoDate.nullish(),
  expiresOn: isoDate.nullish(),
  note: optionalText,
  roundItemId: z.string().uuid().nullish(),
  checklist: z.array(safetyChecklistAnswerSchema).max(50).default([]),
})

const monthlyAssignmentSchema = z.object({
  userId: z.string().uuid(),
  assignmentRole: z.enum(['primary', 'backup']),
})
const monthlySupplySchema = z.object({
  id: z.string().uuid().optional(),
  templateItemId: z.string().uuid().nullable(),
  supplyType: z.enum(['spill_item', 'nss_bottle']),
  internalCode: immutableCode,
  labelTh: z.string().trim().min(1).max(200),
  manufacturedOrPackedOn: isoDate.nullable(),
  purchasedOn: isoDate.nullable(),
  expiresOn: isoDate.nullable(),
  supplier: z.string().trim().max(300).nullable(),
})

export const monthlySafetyAssetConfigSchema = z.object({
  profile: z.enum(['biohazard_spill_kit', 'chemical_spill_kit', 'nss_eyewash']).nullable(),
  activatedOn: isoDate,
  assignments: z.array(monthlyAssignmentSchema).max(20),
  supplies: z.array(monthlySupplySchema).max(100),
}).superRefine((value, context) => {
  if (value.profile && value.assignments.filter(item => item.assignmentRole === 'primary').length !== 1) {
    context.addIssue({ code: 'custom', path: ['assignments'], message: 'ต้องกำหนดผู้รับผิดชอบหลักหนึ่งคนต่อจุด' })
  }
  if (new Set(value.assignments.map(item => item.userId)).size !== value.assignments.length) {
    context.addIssue({ code: 'custom', path: ['assignments'], message: 'ผู้รับผิดชอบหลักและสำรองต้องไม่ซ้ำกัน' })
  }
  if (new Set(value.supplies.map(item => item.internalCode.toLocaleLowerCase('en-US'))).size !== value.supplies.length) {
    context.addIssue({ code: 'custom', path: ['supplies'], message: 'รหัส inventory ภายในจุดต้องไม่ซ้ำกัน' })
  }
  if (value.profile === 'nss_eyewash' && value.supplies.some(item => item.supplyType !== 'nss_bottle')) {
    context.addIssue({ code: 'custom', path: ['supplies'], message: 'Profile NSS รับเฉพาะขวด NSS' })
  }
  if (value.profile?.endsWith('spill_kit') && value.supplies.some(item => item.supplyType !== 'spill_item')) {
    context.addIssue({ code: 'custom', path: ['supplies'], message: 'Profile Spill Kit รับเฉพาะรายการในชุด' })
  }
  if (value.profile && value.supplies.length === 0) {
    context.addIssue({ code: 'custom', path: ['supplies'], message: 'กรุณาลงทะเบียน inventory หรือขวด NSS อย่างน้อยหนึ่งรายการ' })
  }
})

const assemblyPointBaseSchema = z.object({
  code: immutableCode,
  nameTh: z.string().trim().min(1).max(200),
  detailTh: optionalText,
  pointType: z.enum(['assembly', 'safe']).default('assembly'),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  // จุดรวมพลสร้างเป็น working draft ได้ก่อนผูกทางออก; RPC ยืนยันหน้างานและ publish gate
  // จะบังคับให้มีทางออกอย่างน้อยหนึ่งจุดภายหลัง
  exitCodes: z.array(z.enum(['exit-3a', 'exit-3b', 'exit-3c'])).max(3)
    .refine(values => new Set(values).size === values.length, 'ทางออกต้องไม่ซ้ำกัน'),
})

export const assemblyPointInputSchema = assemblyPointBaseSchema.refine(value => (value.latitude == null) === (value.longitude == null), {
  path: ['latitude'], message: 'กรุณาระบุ latitude และ longitude ให้ครบคู่',
})

export const assemblyPointPatchSchema = assemblyPointBaseSchema.omit({ code: true }).partial().extend({
  updatedAt: z.string().datetime({ offset: true }),
  retire: z.boolean().optional(),
})

export const assemblyVerificationFinalizeSchema = z.object({
  key: z.string().min(1),
  fileName: z.string().min(1).max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative().max(100000).nullish(),
  note: optionalText,
})
