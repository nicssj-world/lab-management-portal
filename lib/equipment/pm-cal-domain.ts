export type PmCalType = 'PM' | 'CAL'
export type PmCalResult = 'PASS' | 'FAIL' | 'NOT_PERFORMED' | null
export type PmCalPlanState = 'completed' | 'failed' | 'due_soon' | 'overdue' | 'ok'
export type EquipmentPmCalState = PmCalPlanState | 'not_required' | 'unplanned'

// Thai fiscal year runs Oct–Sep, not Jan–Dec. calendar_month is always stored 1–12 (calendar
// month number), but any UI that lists "every month of the fiscal year" should walk this order —
// otherwise Oct/Nov/Dec (which fall in the *earlier* calendar year of the fiscal year) render
// after Jan–Sep, making the fiscal year look out of order (e.g. "เกินกำหนด · 30/11/2568" appearing
// after "เสร็จแล้ว · 31/05/2569" even though November comes first in fiscal year 2569).
export const FISCAL_MONTH_ORDER: readonly number[] = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9]

export const CALENDAR_MONTH_LABELS_TH: readonly string[] = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

export function compareByFiscalMonth(a: number, b: number): number {
  return FISCAL_MONTH_ORDER.indexOf(a) - FISCAL_MONTH_ORDER.indexOf(b)
}

export interface PmCalPlanRecord {
  id: string
  equipment_id: string
  fiscal_year: number
  calendar_month: number
  cal_type: PmCalType
  due_date: string
  record_status: 'active' | 'cancelled'
  version: number
}

export interface PmCalResultRecord {
  id: string
  plan_id: string | null
  equipment_id: string
  cal_type: PmCalType
  completed_date: string | null
  result: PmCalResult
}

const DAY_MS = 86_400_000

export function fiscalYearForDate(date: Date): number {
  const [calendarYear, calendarMonth] = bangkokIsoDate(date).split('-').map(Number)
  return calendarYear + (calendarMonth >= 10 ? 544 : 543)
}

export function fiscalYearMonthToCalendarYear(fiscalYear: number, calendarMonth: number): number {
  if (!Number.isInteger(calendarMonth) || calendarMonth < 1 || calendarMonth > 12) {
    throw new RangeError('calendarMonth must be between 1 and 12')
  }
  return fiscalYear - (calendarMonth >= 10 ? 544 : 543)
}

export function lastDayOfFiscalMonth(fiscalYear: number, calendarMonth: number): string {
  const year = fiscalYearMonthToCalendarYear(fiscalYear, calendarMonth)
  const day = new Date(year, calendarMonth, 0).getDate()
  return `${year}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function bangkokIsoDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function isStrictIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

function utcDay(value: string | Date): number {
  if (typeof value === 'string') {
    if (!isStrictIsoDate(value)) throw new RangeError(`Invalid ISO date: ${value}`)
    const [year, month, day] = value.split('-').map(Number)
    return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS)
  }
  const [year, month, day] = bangkokIsoDate(value).split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS)
}

// Legacy-imported results predate the plan grid and are intentionally left unlinked (plan_id null)
// rather than guessed onto a specific plan row — but if one falls in the exact month/year/type a
// plan expects, it genuinely satisfies that plan and must count, or the plan nags "overdue" forever
// despite the equipment having actually been done (see PM/CAL history "ไม่ผูกแผน" entries).
function completedWithinPlanPeriod(result: PmCalResultRecord, plan: PmCalPlanRecord): boolean {
  if (!result.completed_date) return false
  const completed = new Date(`${result.completed_date}T00:00:00`)
  return fiscalYearForDate(completed) === plan.fiscal_year && completed.getMonth() + 1 === plan.calendar_month
}

export function computePmCalPlanState(
  plan: PmCalPlanRecord,
  results: PmCalResultRecord[],
  today: Date = new Date(),
  dueSoonDays = 30,
): PmCalPlanState {
  // equipment_id is checked explicitly (not just relied on via plan_id) because unlinked legacy
  // results only carry fiscal_year/calendar_month/cal_type — without this guard, a caller that
  // passes results across multiple pieces of equipment (e.g. an all-equipment report) would let one
  // machine's legacy CAL silently satisfy every other machine's plan in the same month.
  const related = results.filter(item => item.completed_date && item.equipment_id === plan.equipment_id && item.cal_type === plan.cal_type &&
    (item.plan_id === plan.id || (item.plan_id == null && completedWithinPlanPeriod(item, plan))))
  if (plan.cal_type === 'PM' && related.some(item => item.result !== 'NOT_PERFORMED')) return 'completed'
  if (plan.cal_type === 'CAL') {
    // A null result only ever occurs on legacy-imported CAL records (the manual entry form always
    // requires PASS/FAIL/NOT_PERFORMED) — the old system didn't track pass/fail that granularly, so
    // null means "was done" (shown as "ดำเนินการแล้ว" in history), not "unknown, still pending".
    // Precedence: PASS > FAIL > bare null. PASS beats FAIL so a later successful re-cal clears an
    // earlier failure. FAIL beats a lone null so that recording the real outcome later (via
    // "บันทึกผลเพิ่มเติม" on an already-legacy-completed plan) can actually flip it to failed instead
    // of the untouched legacy null silently overriding the real result forever.
    if (related.some(item => item.result === 'PASS')) return 'completed'
    if (related.some(item => item.result === 'FAIL')) return 'failed'
    if (related.some(item => item.result === null)) return 'completed'
  }

  const remainingDays = utcDay(plan.due_date) - utcDay(today)
  if (remainingDays < 0) return 'overdue'
  if (remainingDays <= dueSoonDays) return 'due_soon'
  return 'ok'
}

const EQUIPMENT_STATE_RANK: Record<PmCalPlanState, number> = {
  completed: 0,
  ok: 1,
  due_soon: 2,
  overdue: 3,
  failed: 4,
}

export function computeEquipmentPmCalState(
  needsCalibration: boolean,
  plans: PmCalPlanRecord[],
  results: PmCalResultRecord[],
  today: Date = new Date(),
): EquipmentPmCalState {
  if (!needsCalibration) return 'not_required'
  const activePlans = plans.filter(plan => plan.record_status === 'active')
  if (activePlans.length === 0) return 'unplanned'
  return activePlans
    .map(plan => computePmCalPlanState(plan, results, today))
    .reduce((worst, state) => EQUIPMENT_STATE_RANK[state] > EQUIPMENT_STATE_RANK[worst] ? state : worst)
}
