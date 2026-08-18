import { z } from 'zod'

export interface KpiEntryValidationDefinition {
  id: number
  denominator: string | null
}

const entrySchema = z.object({
  dept_id: z.number().int().positive(),
  kpi_id: z.number().int().positive(),
  fiscal_year: z.number().int().min(2500).max(2999),
  month: z.number().int().min(1).max(12),
  numerator: z.number().finite().nonnegative(),
  denominator: z.number().finite().nonnegative().nullable(),
})

const clearEntrySchema = z.object({
  dept_id: z.number().int().positive(),
  kpi_id: z.number().int().positive(),
  fiscal_year: z.number().int().min(2500).max(2999),
  month: z.number().int().min(1).max(12),
})

const payloadSchema = z.object({
  entries: z.array(entrySchema).default([]),
  clear_entries: z.array(clearEntrySchema).default([]),
})

export type ValidatedKpiEntry = z.infer<typeof entrySchema>
export type ValidatedKpiClearEntry = z.infer<typeof clearEntrySchema>

type ValidationSuccess = {
  ok: true
  entries: ValidatedKpiEntry[]
  clearEntries: ValidatedKpiClearEntry[]
}

type ValidationFailure = { ok: false; error: string }

export type KpiEntryValidationResult = ValidationSuccess | ValidationFailure

export function validateKpiEntryPayload(
  body: unknown,
  definitions: KpiEntryValidationDefinition[],
  activeDepartmentIds?: ReadonlySet<number>,
): KpiEntryValidationResult {
  const parsed = payloadSchema.safeParse(body)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'ข้อมูล KPI ไม่ถูกต้อง' }

  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]))
  const seen = new Set<string>()

  for (const entry of parsed.data.entries) {
    if (activeDepartmentIds && !activeDepartmentIds.has(entry.dept_id)) {
      return { ok: false, error: 'ไม่พบแผนกที่ใช้งานอยู่' }
    }
    const definition = definitionById.get(entry.kpi_id)
    if (!definition) return { ok: false, error: 'ไม่พบตัวชี้วัดที่เลือก' }
    if (definition.denominator !== null && entry.denominator === null) {
      return { ok: false, error: 'ตัวชี้วัดแบบร้อยละต้องกรอกตัวหาร' }
    }
    if (definition.denominator === null && entry.denominator !== null) {
      return { ok: false, error: 'ตัวชี้วัดแบบนับจำนวนไม่ควรมีตัวหาร' }
    }
    if (entry.denominator !== null && entry.numerator > entry.denominator) {
      return { ok: false, error: 'ตัวตั้งต้องไม่มากกว่าตัวหาร' }
    }

    const key = `${entry.dept_id}|${entry.kpi_id}|${entry.fiscal_year}|${entry.month}`
    if (seen.has(key)) return { ok: false, error: 'พบรายการ KPI ซ้ำกัน' }
    seen.add(key)
  }

  for (const entry of parsed.data.clear_entries) {
    if (activeDepartmentIds && !activeDepartmentIds.has(entry.dept_id)) {
      return { ok: false, error: 'ไม่พบแผนกที่ใช้งานอยู่' }
    }
    if (!definitionById.has(entry.kpi_id)) return { ok: false, error: 'ไม่พบตัวชี้วัดที่เลือก' }
    const key = `${entry.dept_id}|${entry.kpi_id}|${entry.fiscal_year}|${entry.month}`
    if (seen.has(key)) return { ok: false, error: 'รายการเดียวกันไม่ควรอยู่ทั้งในบันทึกและล้างข้อมูล' }
    if (seen.has(`clear|${key}`)) return { ok: false, error: 'พบรายการล้างข้อมูลซ้ำกัน' }
    seen.add(`clear|${key}`)
  }

  return { ok: true, entries: parsed.data.entries, clearEntries: parsed.data.clear_entries }
}
