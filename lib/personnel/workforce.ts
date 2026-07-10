export function firstFilledWorkforceLabel(fallback: string, ...values: Array<string | null | undefined>) {
  for (const value of values) {
    const label = value?.trim()
    if (label) return label
  }
  return fallback
}

export function sortWorkforceRowsDescending<T extends { label: string; value: number }>(rows: T[]) {
  return rows.slice().sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'th'))
}
