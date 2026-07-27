export type PmCalType = 'PM' | 'CAL'
export type PmCalResult = 'PASS' | 'FAIL' | 'NOT_PERFORMED' | null
export type PmCalPlanState = 'completed' | 'failed' | 'due_soon' | 'overdue' | 'ok'
export type EquipmentPmCalState = PmCalPlanState | 'not_required' | 'unplanned'

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

export function computePmCalPlanState(
  plan: PmCalPlanRecord,
  results: PmCalResultRecord[],
  today: Date = new Date(),
  dueSoonDays = 30,
): PmCalPlanState {
  const related = results.filter(item => item.plan_id === plan.id && item.completed_date)
  if (plan.cal_type === 'PM' && related.some(item => item.result !== 'NOT_PERFORMED')) return 'completed'
  if (plan.cal_type === 'CAL') {
    if (related.some(item => item.result === 'PASS')) return 'completed'
    if (related.some(item => item.result === 'FAIL')) return 'failed'
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
