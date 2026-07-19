import { z } from 'zod'

const nullableText = z.string().trim().max(4000).nullable().optional().default(null)

export const laboratorySchema = z.object({
  sector: z.enum(['gov', 'priv', 'other']),
  name: z.string().trim().min(1).max(300),
  brand: nullableText,
  address: nullableText,
  contactName: nullableText,
  contactPhone: nullableText,
  contactEmail: z.string().trim().email().nullable().optional().or(z.literal('')).transform(value => value || null),
  publicAccreditationSummary: nullableText,
  active: z.boolean().default(true),
  publishPublic: z.boolean().default(false),
  remark: nullableText,
  ownerIds: z.array(z.string().uuid()).default([]),
  primaryOwnerId: z.string().uuid().nullable().optional().default(null),
})

export const serviceSchema = z.object({
  laboratoryId: z.string().uuid(),
  testId: z.number().int().positive(),
  manualTestName: z.null().optional().default(null),
  testNameSnapshot: z.string().trim().min(1).max(300),
  externalCode: nullableText,
  method: nullableText,
  specimen: nullableText,
  transportCondition: nullableText,
  tatText: nullableText,
  price: z.number().nonnegative().nullable().optional().default(null),
  isPrimary: z.boolean().default(false),
  active: z.boolean().default(true),
  remark: nullableText,
})

export const certificateSchema = z.object({
  laboratoryId: z.string().uuid(),
  standardName: z.string().trim().min(1).max(300),
  accreditationBody: nullableText,
  certificateNo: nullableText,
  scope: nullableText,
  validFrom: z.string().date().nullable().optional().default(null),
  expiresOn: z.string().date(),
  lifecycle: z.enum(['current', 'superseded', 'revoked']).default('current'),
  supersedesId: z.string().uuid().nullable().optional().default(null),
  remark: nullableText,
}).superRefine((value, ctx) => {
  if (value.validFrom && value.expiresOn < value.validFrom) {
    ctx.addIssue({ code: 'custom', message: 'วันหมดอายุต้องไม่ก่อนวันเริ่มมีผล', path: ['expiresOn'] })
  }
})

export type LaboratoryInput = z.infer<typeof laboratorySchema>
export type OutlabServiceInput = z.infer<typeof serviceSchema>
export type OutlabCertificateInput = z.infer<typeof certificateSchema>
