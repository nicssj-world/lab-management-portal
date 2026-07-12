import { z } from 'zod'

// Shared schema for KPI definition create/edit.
export const definitionSchema = z.object({
  code: z.string().trim().min(1).max(40).regex(/^[A-Z0-9_]+$/, 'code ใช้ได้เฉพาะ A-Z, 0-9 และ _'),
  category: z.enum(['TAT', 'ERROR', 'RISK']),
  sub_code: z.string().trim().max(20).nullish().transform((v) => v || null),
  name_th: z.string().trim().min(1).max(200),
  unit: z.string().trim().max(20).nullish().transform((v) => v || null),
  target_type: z.enum(['gte', 'lte', 'eq']),
  target_val: z.number(),
  sort_order: z.number().int().optional(),
  denominator: z.string().trim().max(200).nullish().transform((v) => v || null),
})

// code is the stable key (seeds, exports, presentation dashboard) — not editable after create.
export const definitionEditSchema = definitionSchema.omit({ code: true })
