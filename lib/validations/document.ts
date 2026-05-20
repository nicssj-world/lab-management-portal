import { z } from 'zod'

export const DOC_TYPES = ['QP', 'WI', 'Form', 'Policy', 'Manual', 'Record', 'Others'] as const
export const DOC_STATUSES = ['Draft', 'Review', 'Approved', 'Published', 'Obsolete'] as const
export const DOC_VISIBILITIES = ['Public', 'Internal'] as const

export const DocumentSchema = z.object({
  document_code:  z.string().min(1, 'กรุณากรอกรหัสเอกสาร').max(50),
  title:          z.string().min(1, 'กรุณากรอกชื่อเอกสาร').max(200),
  type:           z.enum(DOC_TYPES, { required_error: 'กรุณาเลือกประเภทเอกสาร' }),
  department:     z.string().optional(),
  revision:       z.string().default('1'),
  status:         z.enum(DOC_STATUSES).default('Draft'),
  visibility:     z.enum(DOC_VISIBILITIES).default('Internal'),
  owner_name:     z.string().optional(),
  reviewer_name:  z.string().optional(),
  approver_name:  z.string().optional(),
  description:    z.string().optional(),
  effective_date:  z.string().optional(),
  expiry_date:     z.string().optional(),
  obsolete_date:   z.string().optional(),
  obsolete_reason: z.string().optional(),
})

export type DocumentInput = z.infer<typeof DocumentSchema>
