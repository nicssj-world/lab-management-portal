export const SAFETY_EQUIPMENT_KINDS = [
  'fire-extinguisher', 'fire-hose', 'manual-call-point', 'aed', 'first-aid-kit',
  'eyewash', 'nss-eyewash', 'emergency-shower', 'spill-kit', 'emergency-shutoff',
] as const

export type SafetyEquipmentKind = typeof SAFETY_EQUIPMENT_KINDS[number]
export type SafetyInspectionResult = 'passed' | 'needs_attention' | 'failed' | 'not_found'
export type SafetyPositionStatus = 'unverified' | 'verified'
export type SafetyOperationalStatus = SafetyPositionStatus | Exclude<SafetyInspectionResult, 'not_found'> | 'overdue' | 'due_soon'

export interface SafetyStatusInput {
  positionStatus: SafetyPositionStatus
  latestResult?: SafetyInspectionResult | null
  nextInspectionDate?: string | null
  expiresOn?: string | null
}

const DAY_MS = 86_400_000

export function deriveSafetyAssetStatus(input: SafetyStatusInput, todayIso: string): SafetyOperationalStatus {
  if (input.positionStatus === 'unverified') return 'unverified'
  if (input.latestResult === 'failed' || input.latestResult === 'not_found') return 'failed'

  const today = Date.parse(`${todayIso}T00:00:00Z`)
  const dueDates = [input.nextInspectionDate, input.expiresOn]
    .filter((value): value is string => Boolean(value))
    .map(value => Date.parse(`${value}T00:00:00Z`))
    .filter(Number.isFinite)
  if (dueDates.some(date => date < today)) return 'overdue'
  if (dueDates.some(date => date - today <= 30 * DAY_MS)) return 'due_soon'
  if (input.latestResult === 'needs_attention') return 'needs_attention'
  return input.latestResult ?? 'verified'
}
