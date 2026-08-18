import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260818171900_quality_task_adhoc_meeting_details.sql'),
  'utf8',
)
const manualMigration = readFileSync(join(process.cwd(), 'scripts/quality-task-adhoc-meeting-details.sql'), 'utf8')
const bootstrap = readFileSync(join(process.cwd(), 'scripts/quality-task-module.sql'), 'utf8')

for (const sql of [migration, manualMigration, bootstrap]) {
  assert.match(sql, /meeting_location\s+text/, 'stores the meeting location or channel')
  assert.match(sql, /meeting_agenda\s+text/, 'stores the meeting agenda')
}

console.log('scripts/quality-task-adhoc-meeting-details.test.ts: all assertions passed')
