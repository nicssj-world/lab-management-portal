/**
 * Time rules for visitor logs.
 *
 * Visitor timestamps are stored as timestamptz. The cutoff is the first
 * midnight after the local Bangkok calendar date of the check-in timestamp.
 */
export const VISITOR_TIME_ZONE = 'Asia/Bangkok'
const BANGKOK_OFFSET = '+07:00'

type DateLike = string | Date

function toDate(value: DateLike): Date | null {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function localDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: VISITOR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  }
}

/** Return the exact ISO instant for the next midnight in Bangkok. */
export function getVisitorAutoCheckoutCutoff(enteredAt: DateLike): string | null {
  const entered = toDate(enteredAt)
  if (!entered) return null

  const { year, month, day } = localDateParts(entered)
  const midnight = new Date(
    `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00${BANGKOK_OFFSET}`,
  )
  if (Number.isNaN(midnight.getTime())) return null

  midnight.setUTCDate(midnight.getUTCDate() + 1)
  return midnight.toISOString()
}

export function isVisitorAutoCheckoutDue(
  enteredAt: DateLike,
  now: DateLike | number = Date.now(),
): boolean {
  const cutoff = getVisitorAutoCheckoutCutoff(enteredAt)
  if (!cutoff) return false

  const nowMs = typeof now === 'number' ? now : toDate(now)?.getTime()
  return Number.isFinite(nowMs) && (nowMs as number) >= Date.parse(cutoff)
}
