import type { Equipment } from '@/lib/queries/equipment'

export type PmCalDueState = 'not_required' | 'unplanned' | 'ok' | 'due_soon' | 'overdue'

export interface PmCalTypeDue {
  state: PmCalDueState
  /** เดือน 1-12 ของเดือนที่ทำให้เกิดสถานะนี้ (เดือนที่แย่ที่สุดในบรรดาเดือนที่ติ๊กไว้) */
  dueMonth: number | null
  dueDate: string | null
}

export interface PmCalDue {
  pm: PmCalTypeDue
  cal: PmCalTypeDue
  worst: PmCalDueState
}

const MONTH_KEYS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

const STATE_RANK: Record<PmCalDueState, number> = {
  not_required: 0,
  ok: 1,
  unplanned: 2,
  due_soon: 3,
  overdue: 4,
}

/** วันที่แบบ "จำนวนวันนับจาก epoch" (UTC, ไม่มีเวลา) — เลี่ยงปัญหา timezone ตอนเทียบวันที่ล้วน ๆ */
function toUtcDay(year: number, monthIndex0: number, day: number): number {
  return Math.floor(Date.UTC(year, monthIndex0, day) / 86400000)
}

function parseIsoDateToUtcDay(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  return toUtcDay(year, month - 1, day)
}

function dateToUtcDay(date: Date): number {
  return toUtcDay(date.getFullYear(), date.getMonth(), date.getDate())
}

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function computeTypeDue(
  plan: Record<string, { pm: boolean; cal: boolean }> | undefined | null,
  type: 'pm' | 'cal',
  lastDateIso: string | null,
  today: Date,
  dueSoonDays: number,
): PmCalTypeDue {
  const year = today.getFullYear()
  const todayDay = dateToUtcDay(today)
  const lastDateDay = lastDateIso ? parseIsoDateToUtcDay(lastDateIso) : null

  const tickedMonths: number[] = []
  for (let index = 0; index < MONTH_KEYS.length; index += 1) {
    if (plan?.[MONTH_KEYS[index]]?.[type]) tickedMonths.push(index)
  }
  if (tickedMonths.length === 0) {
    return { state: 'unplanned', dueMonth: null, dueDate: null }
  }

  let worst: PmCalTypeDue = { state: 'ok', dueMonth: null, dueDate: null }
  for (const monthIndex of tickedMonths) {
    const monthStartDay = toUtcDay(year, monthIndex, 1)
    const lastDayOfMonth = daysInMonth(year, monthIndex)
    const dueDay = monthStartDay + lastDayOfMonth - 1
    const dueDate = `${year}-${pad2(monthIndex + 1)}-${pad2(lastDayOfMonth)}`
    const hasLastDateInMonth = lastDateDay !== null && lastDateDay >= monthStartDay && lastDateDay <= dueDay

    let state: PmCalDueState
    if (dueDay < todayDay && (lastDateDay === null || lastDateDay < monthStartDay)) {
      state = 'overdue'
    } else if (!hasLastDateInMonth && dueDay - todayDay >= 0 && dueDay - todayDay <= dueSoonDays) {
      state = 'due_soon'
    } else {
      state = 'ok'
    }

    if (STATE_RANK[state] > STATE_RANK[worst.state]) {
      worst = { state, dueMonth: monthIndex + 1, dueDate }
    }
  }
  return worst
}

/**
 * ตีความ pm_cal_data.plan เป็นเดือนตามปีปฏิทินปัจจุบัน (ไม่ใช่ปีงบประมาณ) — ตรงกับข้อมูลที่เก็บจริง
 * (plan เก็บ Jan..Dec โดยไม่มีปีกำกับ) ดู CLAUDE.md/แผนงานสำหรับสมมติฐานนี้ ไม่ใช่การแก้ label เดิมใน PmCalModal
 */
export function computePmCalDue(
  input: Pick<Equipment, 'status' | 'needs_calibration' | 'pm_cal_data'>,
  today: Date = new Date(),
  dueSoonDays = 30,
): PmCalDue {
  if (input.status === 'Inactive' || !input.needs_calibration) {
    const notRequired: PmCalTypeDue = { state: 'not_required', dueMonth: null, dueDate: null }
    return { pm: notRequired, cal: notRequired, worst: 'not_required' }
  }

  const plan = input.pm_cal_data?.plan
  const pm = computeTypeDue(plan, 'pm', input.pm_cal_data?.last_pm_date ?? null, today, dueSoonDays)
  const cal = computeTypeDue(plan, 'cal', input.pm_cal_data?.last_cal_date ?? null, today, dueSoonDays)
  const worst = STATE_RANK[cal.state] > STATE_RANK[pm.state] ? cal.state : pm.state
  return { pm, cal, worst }
}
