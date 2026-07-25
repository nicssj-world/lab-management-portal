import assert from 'node:assert/strict'

type TrainingRow = {
  id: string
  topic: string
  training_date: string | null
  provider: string | null
  location: string | null
  notes: string | null
  created_at: string
}

const rows: TrainingRow[] = [
  { id: '1', topic: 'อบรมความปลอดภัย', training_date: '2025-05-12', provider: 'ศูนย์ฝึก', location: 'กรุงเทพฯ', notes: null, created_at: '2025-05-13T00:00:00Z' },
  { id: '2', topic: 'Quality control', training_date: '2024-01-20', provider: 'Lab Academy', location: 'เชียงใหม่', notes: 'หลักสูตรประจำปี', created_at: '2024-01-21T00:00:00Z' },
  { id: '3', topic: 'การสื่อสาร', training_date: null, provider: null, location: null, notes: 'อบรมภายใน', created_at: '2023-02-01T00:00:00Z' },
]

async function main() {
  const mod = await import('./training-filters').catch(() => null)
  assert.ok(mod, 'training filter module should exist')
  assert.equal(typeof mod.filterAndSortTraining, 'function', 'filterAndSortTraining should exist')

  assert.deepEqual(mod.availableTrainingYears(rows), [2025, 2024])
  assert.deepEqual(
    mod.filterAndSortTraining(rows, { year: 2025, query: '', sort: 'newest' }).map((row: TrainingRow) => row.id),
    ['1'],
  )
  assert.deepEqual(
    mod.filterAndSortTraining(rows, { year: 'all', query: 'academy', sort: 'newest' }).map((row: TrainingRow) => row.id),
    ['2'],
  )
  assert.deepEqual(
    mod.filterAndSortTraining(rows, { year: 'all', query: 'ภายใน', sort: 'newest' }).map((row: TrainingRow) => row.id),
    ['3'],
  )
  assert.deepEqual(
    mod.filterAndSortTraining(rows, { year: 'all', query: '', sort: 'oldest' }).map((row: TrainingRow) => row.id),
    ['2', '1', '3'],
  )
}

main()
