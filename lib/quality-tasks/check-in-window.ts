export const CHECK_IN_EARLY_MINUTES = 60

const BANGKOK_OFFSET = '+07:00'
const MINUTE_MS = 60 * 1000

export interface CheckInWindow {
  opensAt: string | null
  notOpenYet: boolean
  manuallyOpened: boolean
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) return null
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? null : timestamp
}

/**
 * Resolve a date/time stored by the Quality module as Bangkok local time.
 * Meeting dates and times are database `date`/`time` values, not UTC values.
 */
export function getScheduledCheckInOpensAt(
  plannedDate: string | null | undefined,
  plannedStartTime: string | null | undefined,
) {
  if (!plannedDate || !/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) return null

  const hasExplicitStartTime = Boolean(plannedStartTime?.trim())
  const startTime = hasExplicitStartTime ? plannedStartTime!.slice(0, 5) : '00:00'
  if (!/^\d{2}:\d{2}$/.test(startTime)) return null

  const scheduledAt = new Date(`${plannedDate}T${startTime}:00${BANGKOK_OFFSET}`)
  if (Number.isNaN(scheduledAt.getTime())) return null

  const opensAt = hasExplicitStartTime
    ? new Date(scheduledAt.getTime() - CHECK_IN_EARLY_MINUTES * MINUTE_MS)
    : scheduledAt
  return opensAt.toISOString()
}

export function getCheckInWindow(
  plannedDate: string | null | undefined,
  plannedStartTime: string | null | undefined,
  manuallyOpenedAt: string | null | undefined,
  now = new Date(),
): CheckInWindow {
  const manualOpen = parseTimestamp(manuallyOpenedAt)
  if (manualOpen) {
    return {
      opensAt: manualOpen.toISOString(),
      notOpenYet: now.getTime() < manualOpen.getTime(),
      manuallyOpened: true,
    }
  }

  const opensAt = getScheduledCheckInOpensAt(plannedDate, plannedStartTime)
  if (!opensAt) {
    return { opensAt: null, notOpenYet: true, manuallyOpened: false }
  }

  return {
    opensAt,
    notOpenYet: now.getTime() < Date.parse(opensAt),
    manuallyOpened: false,
  }
}
