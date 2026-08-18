import { getThaiFiscalYearForMonth } from '../kpi-utils'

const FISCAL_MONTH_ORDER = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9]

export function isValidKpiFiscalYear(year: number): boolean {
  return Number.isInteger(year) && year >= 2500 && year <= 2999
}

export function isValidKpiMonth(month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12
}

export interface KpiPeriod {
  fiscalYear: number
  month: number
}

/**
 * Return the current KPI period using Bangkok time so the API and browser
 * agree around a month boundary even when the server runs in UTC.
 */
export function getCurrentKpiPeriod(now = new Date()): KpiPeriod {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    calendar: 'gregory',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now)
  const calendarYear = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  return {
    fiscalYear: getThaiFiscalYearForMonth(calendarYear, month),
    month,
  }
}

/**
 * KPI input is locked for the current and future periods. A period becomes
 * writable only after the calendar month has ended. Invalid periods are
 * handled by the request validator separately.
 */
export function isKpiPeriodLocked(fiscalYear: number, month: number, now = new Date()): boolean {
  if (!isValidKpiFiscalYear(fiscalYear) || !isValidKpiMonth(month)) return false
  const current = getCurrentKpiPeriod(now)
  const selectedMonthIndex = FISCAL_MONTH_ORDER.indexOf(month)
  const currentMonthIndex = FISCAL_MONTH_ORDER.indexOf(current.month)
  return fiscalYear > current.fiscalYear
    || (fiscalYear === current.fiscalYear && selectedMonthIndex >= currentMonthIndex)
}

/** The last fiscal month that has fully ended at the supplied time. */
export function getPreviousKpiPeriod(now = new Date()): KpiPeriod {
  const current = getCurrentKpiPeriod(now)
  const currentMonthIndex = FISCAL_MONTH_ORDER.indexOf(current.month)
  const previousMonthIndex = currentMonthIndex === 0 ? FISCAL_MONTH_ORDER.length - 1 : currentMonthIndex - 1
  return {
    fiscalYear: currentMonthIndex === 0 ? current.fiscalYear - 1 : current.fiscalYear,
    month: FISCAL_MONTH_ORDER[previousMonthIndex],
  }
}

/** Admins may correct any period; everyone else can edit only closed periods. */
export function canEditKpiPeriod(isAdmin: boolean, fiscalYear: number, month: number, now = new Date()): boolean {
  return isAdmin || !isKpiPeriodLocked(fiscalYear, month, now)
}
