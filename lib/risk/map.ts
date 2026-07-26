export type RiskMapLevel = 'low' | 'medium' | 'high' | 'unassessed'

type IncidentMapRow = { space_code: string | null; severity_level: string | null; status: string }
type RegisterMapRow = { space_code: string | null; level: string | null; residual_level: string | null; status: string }

const LEVEL_RANK: Record<RiskMapLevel, number> = { unassessed: 0, low: 1, medium: 2, high: 3 }

function incidentLevel(value: string | null): RiskMapLevel {
  if (!value) return 'unassessed'
  if (['G', 'H', 'I'].includes(value.toUpperCase())) return 'high'
  if (['D', 'E', 'F'].includes(value.toUpperCase())) return 'medium'
  if (['A', 'B', 'C'].includes(value.toUpperCase())) return 'low'
  return 'unassessed'
}

export function aggregateIncidentMap(rows: readonly IncidentMapRow[]) {
  const groups = new Map<string, { count: number; level: RiskMapLevel; maxSeverity: string | null; unassessedCount: number }>()
  for (const row of rows) {
    if (!row.space_code) continue
    const current = groups.get(row.space_code) ?? { count: 0, level: 'unassessed' as const, maxSeverity: null, unassessedCount: 0 }
    const severity = row.severity_level?.toUpperCase() ?? null
    const level = incidentLevel(severity)
    current.count += 1
    if (level === 'unassessed') current.unassessedCount += 1
    if (LEVEL_RANK[level] > LEVEL_RANK[current.level]) current.level = level
    if (severity && (!current.maxSeverity || severity > current.maxSeverity)) current.maxSeverity = severity
    groups.set(row.space_code, current)
  }
  return [...groups].map(([spaceCode, value]) => ({ spaceCode, ...value }))
}

export function aggregateRegisterMap(rows: readonly RegisterMapRow[]) {
  const groups = new Map<string, { count: number; level: RiskMapLevel; unassessedCount: number }>()
  for (const row of rows) {
    if (!row.space_code || row.status === 'closed') continue
    const raw = row.residual_level ?? row.level
    const level: RiskMapLevel = raw === 'high' || raw === 'medium' || raw === 'low' ? raw : 'unassessed'
    const current = groups.get(row.space_code) ?? { count: 0, level: 'unassessed' as const, unassessedCount: 0 }
    current.count += 1
    if (level === 'unassessed') current.unassessedCount += 1
    if (LEVEL_RANK[level] > LEVEL_RANK[current.level]) current.level = level
    groups.set(row.space_code, current)
  }
  return [...groups].map(([spaceCode, value]) => ({ spaceCode, ...value }))
}
