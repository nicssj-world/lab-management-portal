import { z } from 'zod'
import { DOC_TYPES, DOC_VISIBILITIES } from '@/lib/validations/document'

const FileSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  size: z.number().nonnegative(),
  mime: z.string().min(1),
})

const RegisterSetItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('register'),
    file: FileSchema,
    document_code: z.string(),
    title: z.string(),
    type: z.enum(DOC_TYPES),
    department: z.string(),
    revision: z.string(),
    owner_name: z.string(),
    reviewer_name: z.string(),
    approver_name: z.string(),
    edit_date: z.string(),
    effective_date: z.string(),
    visibility: z.enum(DOC_VISIBILITIES),
  }),
  z.object({
    kind: z.literal('attach'),
    file: FileSchema,
  }),
  z.object({
    kind: z.literal('link-existing'),
    existing_document_id: z.string().uuid(),
  }),
  z.object({
    kind: z.literal('revise-existing'),
    existing_document_id: z.string().uuid(),
    file: FileSchema,
  }),
])

export const RegisterSetSchema = z.object({
  items: z.array(RegisterSetItemSchema).min(1).max(30),
})

export type RegisterSetItem = z.infer<typeof RegisterSetItemSchema>
export type RegisterSetInput = z.infer<typeof RegisterSetSchema>
