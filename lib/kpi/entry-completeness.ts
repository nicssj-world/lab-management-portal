export interface KpiEntryCompletenessDefinition {
  denominator: string | null
}

/**
 * An entry is complete when all fields required by the current KPI definition
 * are present. A percentage KPI may use 0/0 as an explicit no-incident entry;
 * it is complete but has no measurable percentage. A non-zero numerator with
 * a zero denominator is still invalid for evaluation.
 */
export function isKpiEntryComplete(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  definition: KpiEntryCompletenessDefinition,
): boolean {
  if (numerator === null || numerator === undefined || !Number.isFinite(numerator)) return false
  if (definition.denominator === null) return denominator === null || denominator === undefined
  return denominator !== null && denominator !== undefined && Number.isFinite(denominator) &&
    (denominator > 0 || (denominator === 0 && numerator === 0))
}
