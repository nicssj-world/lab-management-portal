import { z } from 'zod'
import { DOC_TYPES, DOC_VISIBILITIES } from '@/lib/validations/document'

const MAX_SET_FILE_SIZE = 50 * 1024 * 1024
const boundedText = (max: number) => z.string().trim().max(max)
const requiredText = (max: number) => boundedText(max).min(1)
const isoDateOrEmpty = z.string().trim().refine((value) => {
  if (!value) return true
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}, 'วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD และเป็นวันที่จริง')

const FileSchema = z.object({
  upload_id: z.string().uuid(),
  key: requiredText(1024),
  name: requiredText(255),
  size: z.number().int().nonnegative().max(MAX_SET_FILE_SIZE),
  mime: requiredText(255),
})

const RegisterSetItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('register'),
    file: FileSchema,
    document_code: requiredText(50),
    title: requiredText(200),
    type: z.enum(DOC_TYPES),
    department: boundedText(100),
    revision: requiredText(30),
    owner_name: boundedText(200),
    reviewer_name: boundedText(200),
    approver_name: boundedText(200),
    edit_date: isoDateOrEmpty,
    effective_date: isoDateOrEmpty,
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
