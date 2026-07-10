export type RiskRow = {
  id: number
  risk_no: string | null
  name: string
  severity_level: string | null
  status: string
  due_date: string | null
  follow_up_date: string | null
}

const SEVERE_LEVELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
const SEVERE_THRESHOLD_INDEX = SEVERE_LEVELS.indexOf('E') // E–I count as severe

function severityRank(level: string | null): number {
  if (!level) return -1
  return SEVERE_LEVELS.indexOf(level.toUpperCase())
}

function isSevere(level: string | null): boolean {
  return severityRank(level) >= SEVERE_THRESHOLD_INDEX
}

export function daysOverdue(dateStr: string | null, todayISO: string): number | null {
  if (!dateStr) return null
  const today = new Date(todayISO).getTime()
  const then = new Date(dateStr).getTime()
  const diffDays = Math.floor((today - then) / 86_400_000)
  return diffDays > 0 ? diffDays : null
}

export function isRiskUrgent(risk: RiskRow, todayISO: string): boolean {
  if (risk.status === 'closed') return false
  const overdue = daysOverdue(risk.due_date, todayISO) != null || daysOverdue(risk.follow_up_date, todayISO) != null
  return overdue || isSevere(risk.severity_level)
}

function riskUrgencyScore(risk: RiskRow, todayISO: string): number {
  const overdueDays = Math.max(
    daysOverdue(risk.due_date, todayISO) ?? 0,
    daysOverdue(risk.follow_up_date, todayISO) ?? 0,
  )
  // severity dominates the sort; overdue days break ties within the same severity
  return severityRank(risk.severity_level) * 100_000 + overdueDays
}

export function filterUrgentRisks(risks: RiskRow[], todayISO: string): RiskRow[] {
  return risks
    .filter(r => isRiskUrgent(r, todayISO))
    .sort((a, b) => riskUrgencyScore(b, todayISO) - riskUrgencyScore(a, todayISO))
}

export function sortByOldestUpdated<T extends { updated_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.updated_at.localeCompare(b.updated_at))
}

export function monthsLeftUntil(endDate: string | null, now = new Date()): number {
  if (!endDate) return 999
  return Math.floor((new Date(endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))
}

export function sortContractsByUrgency<T extends { end_date: string | null; total: number; used: number }>(
  contracts: T[],
): T[] {
  return [...contracts].sort((a, b) => {
    const monthsA = monthsLeftUntil(a.end_date)
    const monthsB = monthsLeftUntil(b.end_date)
    if (monthsA !== monthsB) return monthsA - monthsB
    const remainingA = a.total > 0 ? ((a.total - a.used) / a.total) * 100 : 100
    const remainingB = b.total > 0 ? ((b.total - b.used) / b.total) * 100 : 100
    return remainingB - remainingA
  })
}
