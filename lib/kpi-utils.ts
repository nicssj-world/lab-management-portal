const MONTH_LABELS: Record<number, string> = {
  10: 'ต.ค.',
  11: 'พ.ย.',
  12: 'ธ.ค.',
  1:  'ม.ค.',
  2:  'ก.พ.',
  3:  'มี.ค.',
  4:  'เม.ย.',
  5:  'พ.ค.',
  6:  'มิ.ย.',
  7:  'ก.ค.',
  8:  'ส.ค.',
  9:  'ก.ย.',
}

export function getThaiMonthLabel(month: number): string {
  return MONTH_LABELS[month] ?? String(month)
}

export function getFiscalMonths(): number[] {
  return [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9]
}

export function calcResult(n: number, d: number | null): number | null {
  if (!Number.isFinite(n) || d === null || !Number.isFinite(d) || d < 0) return null
  // 0/0 means there were no incidents to measure. It is a completed entry,
  // but it is not a percentage and must not be compared with the target.
  if (d === 0) return null
  return Math.round((n / d) * 100 * 100) / 100
}

export function isNoIncidentRate(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): boolean {
  return numerator === 0 && denominator === 0
}

export function isPass(
  result: number | null,
  targetType: string,
  targetVal: number,
  numerator?: number,
  isCountMetric = false,
): boolean | null {
  // Count-only KPIs have no percentage result. Every target operator must
  // therefore compare the numerator directly, not only `eq` targets.
  const value = isCountMetric ? numerator : result
  if (value === undefined || value === null) return null
  if (targetType === 'eq') return value === targetVal
  if (targetType === 'gte') return value >= targetVal
  if (targetType === 'lte') return value <= targetVal
  return false
}

export function getCurrentThaiFiscalYear(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 10 ? year + 544 : year + 543
}

export function getPreviousCalendarMonth(date = new Date()): { year: number; month: number } {
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1)
  return {
    year: previous.getFullYear(),
    month: previous.getMonth() + 1,
  }
}

export function getThaiFiscalYearForMonth(year: number, month: number): number {
  return month >= 10 ? year + 544 : year + 543
}

export function getPreviousThaiFiscalMonth(date = new Date()): { fiscalYear: number; year: number; month: number } {
  const previous = getPreviousCalendarMonth(date)
  return {
    ...previous,
    fiscalYear: getThaiFiscalYearForMonth(previous.year, previous.month),
  }
}
