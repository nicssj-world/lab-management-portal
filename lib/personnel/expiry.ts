// Shared expiry / due-date status logic for the personnel module.
// Used by both the roster summary cards and the competency dashboard.

export type ExpiryStatus = 'valid' | 'expiring' | 'expired' | 'none'

// Default lead time (days) before an expiry/due date is flagged "expiring soon".
export const EXPIRY_LEAD_DAYS = 365

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function expiryStatus(
  dateStr: string | null | undefined,
  leadDays = EXPIRY_LEAD_DAYS,
): ExpiryStatus {
  const d = daysUntil(dateStr)
  if (d === null) return 'none'
  if (d < 0) return 'expired'
  if (d <= leadDays) return 'expiring'
  return 'valid'
}

export function daysLeft(dateStr: string | null | undefined): number | null {
  return daysUntil(dateStr)
}

export const EXPIRY_COLOR: Record<ExpiryStatus, string> = {
  valid:    'var(--success)',
  expiring: 'var(--warning)',
  expired:  'var(--danger)',
  none:     'var(--muted)',
}

export const EXPIRY_LABEL_TH: Record<ExpiryStatus, string> = {
  valid:    'ปกติ',
  expiring: 'ใกล้หมดอายุ',
  expired:  'หมดอายุ',
  none:     '—',
}
