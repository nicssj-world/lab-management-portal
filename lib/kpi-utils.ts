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
  if (d === null) return null
  if (d === 0) return null
  return Math.round((n / d) * 100 * 100) / 100
}

export function isPass(
  result: number | null,
  targetType: string,
  targetVal: number,
  numerator?: number
): boolean | null {
  if (targetType === 'eq') {
    if (numerator === undefined || numerator === null) return null
    return numerator === 0
  }
  if (result === null) return null
  if (targetType === 'gte') return result >= targetVal
  if (targetType === 'lte') return result <= targetVal
  return false
}

export function getCurrentThaiFiscalYear(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 10 ? year + 544 : year + 543
}
