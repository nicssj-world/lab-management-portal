export interface SatisfactionTargetRow {
  metric_code: string
  fiscal_year: number
  target_val: number | null
}

export function getLatestSatisfactionTarget(
  rows: SatisfactionTargetRow[],
  metricCode: string,
  fallback: number,
): number {
  const matching = rows
    .filter((row) => row.metric_code === metricCode && row.target_val != null)
    .sort((a, b) => b.fiscal_year - a.fiscal_year)
  return matching[0]?.target_val ?? fallback
}
