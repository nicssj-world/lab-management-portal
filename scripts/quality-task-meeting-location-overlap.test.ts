import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const migration = read('supabase/migrations/20260904170000_quality_task_meeting_location_overlap.sql')
const manualScript = read('scripts/quality-task-meeting-location-overlap.sql')

for (const sql of [migration, manualScript]) {
  assert.ok(sql.includes('meeting_location'), 'location participates in the overlap guard')
  assert.ok(sql.includes('pg_advisory_xact_lock'), 'the database race guard serializes slot writes')
  assert.ok(sql.includes('CREATE TRIGGER guard_quality_task_meeting_slot'), 'the overlap trigger is installed')
  assert.ok(sql.includes('meeting_location, note'), 'editing location reruns the overlap trigger')
  assert.ok(sql.includes('nullif(pg_catalog.btrim(NEW.meeting_location), \'\') IS NULL'), 'missing new locations conflict with every location')
  assert.ok(sql.includes('nullif(pg_catalog.btrim(existing.meeting_location), \'\') IS NULL'), 'missing existing locations conflict with every location')
  assert.ok(sql.includes('pg_catalog.lower(pg_catalog.btrim(NEW.meeting_location))'), 'English location matching is case-insensitive')
  assert.ok(sql.includes("MESSAGE = 'สถานที่และช่วงเวลาดังกล่าวมีประชุมแล้ว'"), 'database errors explain the location conflict')
}

console.log('scripts/quality-task-meeting-location-overlap.test.ts: all assertions passed')
