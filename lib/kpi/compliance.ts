import { getThaiFiscalYearForMonth } from '@/lib/kpi-utils'

const FISCAL_MONTH_ORDER = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const BANGKOK_TIME_ZONE = 'Asia/Bangkok'

export const SUBMISSION_STATUSES = [
  'not_tracked',
  'not_open',
  'pending',
  'on_time',
  'missed',
  'not_applicable',
] as const

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

export interface FiscalPeriod {
  fiscalYear: number
  month: number
}

export interface ClassifySubmissionStatusInput {
  period: FiscalPeriod
  currentPeriod: FiscalPeriod
  trackingStart: FiscalPeriod
  requiredCount: number
  filledCount: number
  firstCompletedAt?: string | null
  /** The rollout baseline is closed by definition, so a complete snapshot passes. */
  baseline?: boolean
  now?: Date
  deadlineDay?: number
}

/**
 * Fiscal months are ordered October through September. Keeping this ordering
 * in one place prevents a December/January boundary from being compared as a
 * normal calendar month.
 */
export function compareFiscalPeriods(a: FiscalPeriod, b: FiscalPeriod): -1 | 0 | 1 {
  const aIndex = a.fiscalYear * 12 + FISCAL_MONTH_ORDER.indexOf(a.month)
  const bIndex = b.fiscalYear * 12 + FISCAL_MONTH_ORDER.indexOf(b.month)
  return aIndex === bIndex ? 0 : aIndex < bIndex ? -1 : 1
}

/** Return the Gregorian calendar year in which a fiscal-month KPI was measured. */
export function getGregorianYearForFiscalMonth(fiscalYear: number, month: number): number {
  if (!Number.isInteger(fiscalYear) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('Invalid fiscal period')
  }
  return month >= 10 ? fiscalYear - 544 : fiscalYear - 543
}

/**
 * KPI month M is submitted in the following calendar month, by the end of
 * day 15 in Bangkok time. The returned ISO date is deliberately date-only so
 * it can be stored in Postgres as a `date` without timezone drift.
 */
export function getSubmissionDeadline(fiscalYear: number, month: number, deadlineDay = 15): string {
  if (!Number.isInteger(deadlineDay) || deadlineDay < 1 || deadlineDay > 28) {
    throw new RangeError('deadlineDay must be between 1 and 28')
  }
  const measuredYear = getGregorianYearForFiscalMonth(fiscalYear, month)
  const deadlineMonth = month === 12 ? 1 : month + 1
  const deadlineYear = month === 12 ? measuredYear + 1 : measuredYear
  return `${deadlineYear}-${String(deadlineMonth).padStart(2, '0')}-${String(deadlineDay).padStart(2, '0')}`
}

export function getCurrentFiscalPeriod(now = new Date()): FiscalPeriod {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BANGKOK_TIME_ZONE,
    calendar: 'gregory',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  return { fiscalYear: getThaiFiscalYearForMonth(year, month), month }
}

function deadlineEndMs(fiscalYear: number, month: number, deadlineDay: number): number {
  return Date.parse(`${getSubmissionDeadline(fiscalYear, month, deadlineDay)}T23:59:59.999+07:00`)
}

export function isSubmissionComplete(requiredCount: number, filledCount: number): boolean {
  return requiredCount > 0 && filledCount >= requiredCount
}

/**
 * Calculate a period status from immutable submission history and the current
 * count. `firstCompletedAt` is intentionally used instead of the latest edit,
 * so completing a missed period later cannot turn it into on-time.
 */
export function classifySubmissionStatus(input: ClassifySubmissionStatusInput): SubmissionStatus {
  const requiredCount = Math.max(0, Math.trunc(input.requiredCount))
  const filledCount = Math.max(0, Math.trunc(input.filledCount))
  if (requiredCount === 0) return 'not_applicable'

  const complete = isSubmissionComplete(requiredCount, filledCount)
  // The rollout deliberately includes one closed baseline period immediately
  // before trackingStart, even though its fiscal ordering is older.
  if (input.baseline) return complete ? 'on_time' : 'missed'

  const trackingComparison = compareFiscalPeriods(input.period, input.trackingStart)
  if (trackingComparison < 0) return 'not_tracked'

  const currentComparison = compareFiscalPeriods(input.period, input.currentPeriod)
  if (currentComparison >= 0) return 'not_open'

  const nowMs = (input.now ?? new Date()).getTime()
  const dueMs = deadlineEndMs(input.period.fiscalYear, input.period.month, input.deadlineDay ?? 15)

  if (!complete) return nowMs <= dueMs ? 'pending' : 'missed'

  if (!input.firstCompletedAt) return nowMs <= dueMs ? 'on_time' : 'missed'
  const firstCompletedMs = Date.parse(input.firstCompletedAt)
  return Number.isFinite(firstCompletedMs) && firstCompletedMs <= dueMs ? 'on_time' : 'missed'
}

export function getSubmissionStatusLabel(status: SubmissionStatus): string {
  switch (status) {
    case 'on_time': return 'ทันเวลา'
    case 'missed': return 'ขาด'
    case 'pending': return 'รอส่ง'
    case 'not_open': return 'ยังไม่ถึงงวด'
    case 'not_tracked': return 'นอกช่วงติดตาม'
    case 'not_applicable': return 'ไม่เกี่ยวข้อง'
  }
}
