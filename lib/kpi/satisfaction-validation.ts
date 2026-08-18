import { z } from 'zod'

const satisfactionSchema = z.object({
  metric_code: z.string().trim().min(1).max(40).regex(/^[a-z0-9_]+$/),
  metric_name: z.string().trim().min(1).max(200),
  fiscal_year: z.number().int().min(2500).max(2999),
  value: z.number().finite().min(0).max(100).nullable(),
  target_val: z.number().finite().min(0).max(100).optional(),
})

export type ValidatedKpiSatisfaction = z.infer<typeof satisfactionSchema>

export function validateKpiSatisfactionPayload(body: unknown):
  | { ok: true; data: ValidatedKpiSatisfaction }
  | { ok: false; error: string } {
  const parsed = satisfactionSchema.safeParse(body)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'ข้อมูลความพึงพอใจไม่ถูกต้อง' }
  return { ok: true, data: parsed.data }
}
