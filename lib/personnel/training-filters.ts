export type TrainingDateSort = 'newest' | 'oldest'

export type TrainingFilterRow = {
  id: string
  topic: string
  training_date: string | null
  provider: string | null
  location: string | null
  notes: string | null
  created_at: string
}

export function availableTrainingYears(rows: TrainingFilterRow[]): number[] {
  return [...new Set(rows.flatMap((row) => {
    const match = row.training_date?.match(/^(\d{4})-/)
    return match ? [Number(match[1])] : []
  }))].sort((a, b) => b - a)
}

export function filterAndSortTraining<T extends TrainingFilterRow>(
  rows: T[],
  { year, query, sort }: { year: number | 'all'; query: string; sort: TrainingDateSort },
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('th-TH')
  const matches = (value: string | null) => value?.toLocaleLowerCase('th-TH').includes(normalizedQuery) ?? false

  return rows
    .filter((row) => year === 'all' || row.training_date?.startsWith(`${year}-`))
    .filter((row) => !normalizedQuery || matches(row.topic) || matches(row.provider) || matches(row.location) || matches(row.notes))
    .sort((left, right) => {
      if (!left.training_date && !right.training_date) return right.created_at.localeCompare(left.created_at)
      if (!left.training_date) return 1
      if (!right.training_date) return -1
      const comparison = left.training_date.localeCompare(right.training_date)
      return sort === 'newest' ? -comparison : comparison
    })
}
