import { z } from 'zod'

const nullableText = z.string().trim().max(4000).nullable().optional().default(null)
const optionalNullableText = z.string().trim().max(4000).nullable().optional()

export const providerSchema = z.object({
  name: z.string().trim().min(1).max(300),
  shortName: nullableText,
  contactName: nullableText,
  contactPhone: nullableText,
  contactEmail: z.string().trim().email().nullable().optional().or(z.literal('')).transform(value => value || null),
  active: z.boolean().default(true),
  remark: nullableText,
})

export const programSchema = z.object({
  providerId: z.string().uuid(),
  fiscalYearBe: z.number().int().min(2500).max(3000),
  programCode: nullableText,
  name: z.string().trim().min(1).max(300),
  discipline: nullableText,
  programType: z.enum(['eqa_pt', 'interlaboratory_comparison', 'alternative_assessment']),
  active: z.boolean().default(true),
  remark: nullableText,
  ownerIds: z.array(z.string().uuid()).default([]),
  primaryOwnerId: z.string().uuid().nullable().optional().default(null),
})

export const programTestSchema = z.object({
  programId: z.string().uuid(),
  testId: z.number().int().positive().nullable().default(null),
  manualTestName: z.string().trim().min(1).max(300).nullable().default(null),
  testNameSnapshot: z.string().trim().min(1).max(300),
  analyteCode: nullableText,
  active: z.boolean().default(true),
}).superRefine((value, ctx) => {
  if (Boolean(value.testId) === Boolean(value.manualTestName)) {
    ctx.addIssue({ code: 'custom', message: 'ต้องเลือก Catalog หรือกรอกชื่อรายการตรวจอย่างใดอย่างหนึ่ง', path: ['testId'] })
  }
})

export const coverageSchema = z.object({
  testId: z.number().int().positive(),
  fiscalYearBe: z.number().int().min(2500).max(3000),
  mode: z.enum(['required_eqa', 'alternative', 'not_applicable']),
  reason: nullableText,
}).superRefine((value, ctx) => {
  if (value.mode !== 'required_eqa' && !value.reason?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'กรุณาระบุเหตุผล', path: ['reason'] })
  }
})

export const roundSchema = z.object({
  programId: z.string().uuid(),
  roundCode: z.string().trim().min(1).max(100),
  expectedReceiptOn: z.string().date().nullable().optional().default(null),
  receivedOn: z.string().date().nullable().optional().default(null),
  submissionDueOn: z.string().date(),
  submittedOn: z.string().date().nullable().optional().default(null),
  reportReceivedOn: z.string().date().nullable().optional().default(null),
  status: z.enum(['planned', 'received', 'submitted', 'reviewed', 'capa_open', 'closed']).default('planned'),
  note: nullableText,
})

export const resultSchema = z.object({
  programTestId: z.string().uuid(),
  sampleCode: nullableText,
  reportedValue: nullableText,
  targetValue: nullableText,
  zScore: z.number().nullable().optional().default(null),
  sdi: z.number().nullable().optional().default(null),
  score: z.number().nullable().optional().default(null),
  outcome: z.enum(['acceptable', 'unacceptable', 'not_evaluated']),
  reason: nullableText,
  note: nullableText,
}).superRefine((value, ctx) => {
  if (value.outcome === 'not_evaluated' && !value.reason?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'ผล Not evaluated ต้องมีเหตุผล', path: ['reason'] })
  }
})

export const capaSchema = z.object({
  roundId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  rootCause: z.string().trim().min(1).max(4000),
  immediateCorrection: nullableText,
  correctiveAction: z.string().trim().min(1).max(4000),
  ownerId: z.string().uuid(),
  dueOn: z.string().date(),
  resultIds: z.array(z.string().uuid()).min(1),
})

export const capaUpdateSchema = z.object({
  status: z.enum(['open', 'completed', 'verified']).optional(),
  title: z.string().trim().min(1).max(300).optional(),
  rootCause: z.string().trim().min(1).max(4000).optional(),
  immediateCorrection: optionalNullableText,
  correctiveAction: z.string().trim().min(1).max(4000).optional(),
  ownerId: z.string().uuid().optional(),
  dueOn: z.string().date().optional(),
  effectivenessResult: optionalNullableText,
  resultIds: z.array(z.string().uuid()).min(1).optional(),
})

export type EqaProgramInput = z.infer<typeof programSchema>
export type EqaRoundInput = z.infer<typeof roundSchema>
export type EqaResultInput = z.infer<typeof resultSchema>
