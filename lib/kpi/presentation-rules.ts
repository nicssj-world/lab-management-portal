export interface KpiSeriesPoint {
  num: number | null
  den: number | null
  pct: number | null
}

export function hasKpiSeriesData(series: KpiSeriesPoint[]): boolean {
  return series.some((point) => point.num !== null || point.den !== null || point.pct !== null)
}

export function summarizeCountSeries(series: Array<{ num: number | null }>): { total: number; monthsWithData: number } {
  return {
    total: series.reduce((sum, point) => sum + (point.num ?? 0), 0),
    monthsWithData: series.filter((point) => point.num !== null).length,
  }
}

export function getChartYMin(target: number, values: number[], override?: number): number {
  if (override !== undefined) return override
  const minimum = Math.min(target, ...values, 80)
  return Math.max(0, Math.floor(minimum / 10) * 10)
}
