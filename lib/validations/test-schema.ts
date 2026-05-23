import { z } from 'zod'

export const testSchema = z.object({
  code:                z.string().min(1, 'กรุณากรอกรหัสรายการตรวจ'),
  lis_code:            z.string().optional(),
  category_id:         z.string().min(1, 'กรุณาเลือกหมวดหมู่'),
  th:                  z.string().min(1, 'กรุณากรอกชื่อภาษาไทย'),
  en:                  z.string().default(''),
  short_name:          z.string().optional(),
  description:         z.string().optional(),
  department:          z.string().optional(),
  active:              z.boolean().default(true),
  contact_staff:       z.boolean().default(false),
  popular:             z.boolean().default(false),
  price:               z.coerce.number().nonnegative().optional().nullable(),
  tat_minutes:         z.string().optional().nullable(),
  urgent_tat_minutes:  z.string().optional().nullable(),
  available_24hr:      z.boolean().default(false),
  service:             z.string().optional(),
  method:              z.string().optional(),
  instrument:          z.string().optional(),
  methodology_note:    z.string().optional(),
  tube:                z.string().optional(),
  tube_color:          z.string().optional(),
  volume:              z.string().optional(),
  stability:           z.string().optional(),
  transport_condition: z.string().optional(),
  reject:              z.string().optional(),
  specimen_note:       z.string().optional(),
  cgd:                 z.string().optional(),
  loinc:               z.string().optional(),
  contact_name:        z.string().optional(),
  contact_phone:       z.string().optional(),
  contact_email:       z.string().optional(),
  contact_note:        z.string().optional(),
  ref:                 z.string().optional(),
  ref_note:            z.string().optional(),
  related_doc_ids:     z.array(z.string()).optional(),
})

export const referenceRangeSchema = z.object({
  id:          z.number().optional(),
  gender:      z.enum(['M', 'F', 'All']).default('All'),
  min_age:     z.coerce.number().nonnegative().optional().nullable(),
  max_age:     z.coerce.number().nonnegative().optional().nullable(),
  lower_limit: z.coerce.number().optional().nullable(),
  upper_limit: z.coerce.number().optional().nullable(),
  unit:        z.string().optional(),
  note:        z.string().optional(),
  sort_order:  z.number().int().default(0),
})

export type TestFormData      = z.infer<typeof testSchema>
export type ReferenceRangeRow = z.infer<typeof referenceRangeSchema>
