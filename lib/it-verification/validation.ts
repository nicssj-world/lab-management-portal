import { z } from 'zod'

export const SampleResultSchema = z.enum(['pass', 'fail', 'na']).nullable()
export const TransferPointSchema = z.enum(['lis_to_his', 'source_to_lis'])
export const FindingStatusSchema = z.enum(['open', 'in_progress', 'closed'])

export const FindingInputSchema = z.object({
  transferPoint: TransferPointSchema,
  description: z.string().trim().min(1, 'กรุณาระบุรายละเอียดปัญหา').max(2000),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
})

export const sampleUpdateSchema = z.object({
  lisToHis: SampleResultSchema,
  sourceToLis: SampleResultSchema,
  remark: z.string().trim().max(2000).default(''),
  findings: z.array(FindingInputSchema).max(2).default([]),
}).superRefine((value, context) => {
  if ((value.lisToHis === 'na' || value.sourceToLis === 'na') && value.remark.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['remark'], message: 'ผล N/A ต้องระบุหมายเหตุ' })
  }
})

export const periodSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  quarter: z.number().int().min(1).max(4),
})

export const generateSamplingSchema = z.object({
  uploadId: z.string().uuid(),
  departmentId: z.number().int().positive().nullable().optional(),
})

export const resampleSchema = z.object({
  uploadId: z.string().uuid(),
  departmentId: z.number().int().positive(),
  reason: z.string().trim().min(5, 'กรุณาระบุเหตุผลการสุ่มใหม่').max(500),
})

export const findingUpdateSchema = z.object({
  status: FindingStatusSchema,
  resolutionNote: z.string().trim().max(2000).default(''),
}).superRefine((value, context) => {
  if (value.status === 'closed' && value.resolutionNote.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['resolutionNote'], message: 'การปิด finding ต้องระบุวิธีแก้ไข' })
  }
})

export const reviewSchema = z.object({
  decision: z.enum(['approve', 'return']),
  note: z.string().trim().max(1000).default(''),
}).superRefine((value, context) => {
  if (value.decision === 'return' && value.note.length < 5) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'กรุณาระบุเหตุผลที่ส่งกลับแก้ไข' })
  }
})

export const reasonSchema = z.object({ reason: z.string().trim().min(5, 'กรุณาระบุเหตุผล').max(500) })

export const sectionMapSchema = z.object({
  sourceLabSection: z.string().trim().min(1, 'กรุณาระบุ lab section').max(200),
  departmentId: z.number().int().positive(),
  isActive: z.boolean().default(true),
})

export const assigneeSchema = z.object({
  roundId: z.string().uuid(),
  departmentId: z.number().int().positive(),
  profileId: z.string().uuid(),
})

export type SampleUpdateInput = z.infer<typeof sampleUpdateSchema>
