export type EqaDeadlineUrgency = 'normal' | 'upcoming' | 'due-soon' | 'critical' | 'overdue'
export type EqaCoverageMode = 'required_eqa' | 'alternative' | 'not_applicable'
export type EqaResultOutcome = 'acceptable' | 'unacceptable' | 'not_evaluated'
export type EqaRoundStatus = 'planned' | 'received' | 'submitted' | 'reviewed' | 'capa_open' | 'closed'

const EQA_ROUND_TRANSITIONS: Record<EqaRoundStatus, EqaRoundStatus[]> = {
  planned: ['received'],
  received: ['submitted'],
  submitted: ['reviewed', 'capa_open'],
  reviewed: ['capa_open'],
  capa_open: ['reviewed'],
  closed: [],
}

export function canTransitionEqaRound(from: EqaRoundStatus, to: EqaRoundStatus) {
  return from === to || EQA_ROUND_TRANSITIONS[from].includes(to)
}

const DAY_MS = 86_400_000

function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

export function fiscalYearBeForDate(value: string): number {
  const date = parseDate(value)
  const calendarYear = date.getUTCFullYear()
  const fiscalEndYear = date.getUTCMonth() >= 9 ? calendarYear + 1 : calendarYear
  return fiscalEndYear + 543
}

export function deadlineUrgency(dueOn: string, today: string): EqaDeadlineUrgency {
  const remaining = Math.round((parseDate(dueOn).getTime() - parseDate(today).getTime()) / DAY_MS)
  if (remaining < 0) return 'overdue'
  if (remaining <= 7) return 'critical'
  if (remaining <= 14) return 'due-soon'
  if (remaining <= 30) return 'upcoming'
  return 'normal'
}

export type RoundClosureInput = {
  expectedResultCount: number
  recordedResultCount: number
  reportAttachmentCount: number
  unacceptableResultIds: string[]
  resolvedUnacceptableResultIds: string[]
}

export type RoundClosureBlocker = 'results-incomplete' | 'report-required' | 'capa-required'

export function roundClosureBlockers(input: RoundClosureInput): RoundClosureBlocker[] {
  const blockers: RoundClosureBlocker[] = []
  if (input.recordedResultCount < input.expectedResultCount) blockers.push('results-incomplete')
  if (input.reportAttachmentCount < 1) blockers.push('report-required')
  const resolved = new Set(input.resolvedUnacceptableResultIds)
  if (input.unacceptableResultIds.some(id => !resolved.has(id))) blockers.push('capa-required')
  return blockers
}

export function summarizeCoverage(rows: Array<{
  mode: EqaCoverageMode
  linkedProgram: boolean
  completedRound: boolean
}>) {
  const eligibleRows = rows.filter(row => row.mode !== 'not_applicable')
  const eligible = eligibleRows.length
  const planned = eligibleRows.filter(row => row.linkedProgram).length
  const completed = eligibleRows.filter(row => row.completedRound).length
  const pct = (value: number) => eligible ? Number(((value / eligible) * 100).toFixed(2)) : 0
  return { eligible, planned, completed, plannedPct: pct(planned), completedPct: pct(completed) }
}
