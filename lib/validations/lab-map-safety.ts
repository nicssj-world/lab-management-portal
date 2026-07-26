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

export const inspectionFinalizeSchema = z.object({
  key: z.string().min(1),
  fileName: z.string().min(1).max(255),
  result: z.enum(['passed', 'needs_attention', 'failed', 'not_found']),
  inspectedOn: isoDate,
  nextInspectionDate: isoDate.nullish(),
  expiresOn: isoDate.nullish(),
  note: optionalText,
})

const assemblyPointBaseSchema = z.object({
  code: immutableCode,
  nameTh: z.string().trim().min(1).max(200),
  detailTh: optionalText,
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
