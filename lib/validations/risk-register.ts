import { z } from 'zod'

const optionalText = z.string().trim().max(4000).nullish()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD')
const scale = z.number().int().min(1, 'ต้องอยู่ระหว่าง 1 ถึง 5').max(5, 'ต้องอยู่ระหว่าง 1 ถึง 5')

export const REGISTER_STATUS_VALUES = ['open', 'treating', 'monitoring', 'accepted', 'closed'] as const

// score/level/residual_score/residual_level เป็น generated column ใน DB
// จึงไม่อยู่ใน schema นี้โดยตั้งใจ — เขียนค่าเหล่านั้นเองไม่ได้และไม่ควรได้
export const riskRegisterSchema = z.object({
  risk_no: optionalText,
  assessed_date: isoDate,
  department: optionalText,
  hazard_category: optionalText,
  process_step: optionalText,
  risk_statement: z.string().trim().min(1, 'ต้องกรอกเหตุการณ์ความเสี่ยง').max(4000),
  affected_parties: optionalText,
  causes: optionalText,
  existing_controls: optionalText,
  additional_controls: optionalText,
  reference_docs: optionalText,
  likelihood: scale.nullish(),
  impact: scale.nullish(),
  owner: optionalText,
  status: z.enum(REGISTER_STATUS_VALUES).optional(),
  next_review_date: isoDate.nullish(),
})

export const riskRegisterPatchSchema = riskRegisterSchema.partial()

export const residualSchema = z.object({
  residual_likelihood: scale,
  residual_impact: scale,
  risk_accepted_by_name: optionalText,
})

export const registerActionSchema = z.object({
  action_type: z.enum(['correction', 'corrective', 'preventive', 'follow_up']),
  description: z.string().trim().min(1, 'ต้องกรอกรายละเอียดมาตรการ').max(2000),
  owner: optionalText,
  due_date: isoDate.nullish(),
  status: z.enum(['open', 'in_progress', 'done']).optional(),
  evidence: optionalText,
  result: optionalText,
  is_effective: z.boolean().nullish(),
  followed_by: optionalText,
  follow_up_date: isoDate.nullish(),
  next_follow_up_date: isoDate.nullish(),
})

export const registerActionPatchSchema = registerActionSchema.partial().extend({
  id: z.number().int().positive(),
})

export type RiskRegisterInput = z.infer<typeof riskRegisterSchema>
