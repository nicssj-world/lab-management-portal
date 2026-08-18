import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260818120000_quality_task_meeting_times.sql'),
  'utf8',
)
const manualMigration = readFileSync(join(process.cwd(), 'scripts/quality-task-meeting-times.sql'), 'utf8')
const bootstrap = readFileSync(join(process.cwd(), 'scripts/quality-task-module.sql'), 'utf8')

for (const sql of [migration, manualMigration, bootstrap]) {
  assert.match(sql, /planned_start_time\s+time/, 'stores the planned meeting start time')
  assert.match(sql, /planned_end_time\s+time/, 'stores the planned meeting end time')
  assert.match(sql, /planned_end_time\s*>\s*planned_start_time/, 'requires the end time after the start time')
}

console.log('scripts/quality-task-meeting-times.test.ts: all assertions passed')
