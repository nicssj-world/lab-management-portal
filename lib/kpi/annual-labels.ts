export function getKpiNumeratorLabel(category: string): string {
  if (category === 'TAT') return 'ทันเวลา'
  if (category === 'ERROR') return 'คลาดเคลื่อน'
  return 'จำนวน'
}

export function getKpiTargetLabel(definition: {
  target_type: 'gte' | 'lte' | 'eq'
  target_val: number
  unit?: string | null
  denominator?: string | null
  denominator_label?: string | null
}): string {
  const isCountMetric = definition.denominator === null || definition.denominator_label === null
  const suffix = definition.unit ?? (isCountMetric ? '' : '%')
  if (definition.target_type === 'eq') return `= ${definition.target_val}${suffix}`.trim()
  const operator = definition.target_type === 'gte' ? '≥' : '≤'
  return `${operator} ${definition.target_val}${suffix}`
}
