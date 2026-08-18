export interface SatisfactionMetricRef {
  code: string
  name: string
}

export interface SatisfactionYearRef {
  metric_code: string
  fiscal_year: number
  value: number | null
}

export function getMissingSatisfactionMetrics(
  metrics: SatisfactionMetricRef[],
  fiscalYear: number,
  existing: SatisfactionYearRef[],
): SatisfactionMetricRef[] {
  const existingCodes = new Set(
    existing.filter((row) => row.fiscal_year === fiscalYear).map((row) => row.metric_code),
  )
  return metrics.filter((metric) => !existingCodes.has(metric.code))
}

function hashMetricName(value: string): string {
  let hash = 0
  for (const character of value) hash = ((hash << 5) - hash + character.codePointAt(0)!) >>> 0
  return hash.toString(36)
}

export function buildMetricCode(name: string, existingCodes: ReadonlySet<string>): string {
  const base = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  const root = (base || `metric_${hashMetricName(name.trim())}`).slice(0, 32)
  let code = root
  let suffix = 2
  while (existingCodes.has(code)) {
    code = `${root.slice(0, 38 - String(suffix).length)}_${suffix}`
    suffix++
  }
  return code
}
