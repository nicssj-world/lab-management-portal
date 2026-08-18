export interface KpiEntryFormValue {
  numerator: string
  denominator: string
}

export interface KpiSaveDefinition {
  id: number
  denominator: string | null
}

export interface KpiSaveContext {
  dept_id: number
  fiscal_year: number
  month: number
}

export interface KpiSaveEntry {
  dept_id: number
  kpi_id: number
  fiscal_year: number
  month: number
  numerator: number
  denominator: number | null
}

export interface KpiClearEntry {
  dept_id: number
  kpi_id: number
  fiscal_year: number
  month: number
}

export interface KpiSavePayload {
  entries: KpiSaveEntry[]
  clear_entries: KpiClearEntry[]
}

export function buildKpiSavePayload(
  defs: KpiSaveDefinition[],
  values: Record<number, KpiEntryFormValue>,
  context: KpiSaveContext,
): KpiSavePayload {
  const entries: KpiSaveEntry[] = []
  const clear_entries: KpiClearEntry[] = []

  for (const def of defs) {
    const value = values[def.id] ?? { numerator: '', denominator: '' }
    if (value.numerator.trim() === '') {
      clear_entries.push({ ...context, kpi_id: def.id })
      continue
    }

    const numerator = Number(value.numerator)
    const denominator = def.denominator === null || value.denominator.trim() === ''
      ? null
      : Number(value.denominator)
    entries.push({ ...context, kpi_id: def.id, numerator, denominator })
  }

  return { entries, clear_entries }
}
