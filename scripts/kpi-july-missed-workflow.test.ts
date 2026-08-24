import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const migrationPath = fs
  .readdirSync(path.resolve('supabase/migrations'))
  .find((file) => /^\d+_kpi_july_missed_workflow\.sql$/.test(file))

assert.ok(migrationPath, 'the July missed-workflow correction migration must exist')

const migration = fs.readFileSync(path.resolve('supabase/migrations', migrationPath), 'utf8')

assert.match(migration, /UPDATE\s+public\.kpi_submission_periods/i)
assert.match(migration, /tracking_start_month\s*=\s*7/i)
assert.match(migration, /fiscal_year\s*=\s*2569/i)
assert.match(migration, /month\s*=\s*7/i)
assert.match(migration, /filled_count\s*<\s*required_count/i)
assert.match(migration, /status\s*=\s*CASE/i)
assert.match(migration, /status_source\s*=\s*CASE/i)
assert.match(migration, /THEN\s*'live'/i)
assert.match(migration, /(?:THEN|ELSE)\s*'baseline'/i)
assert.match(migration, /'missed'/i)
assert.match(migration, /first_completed_at\s*=\s*CASE/i)
assert.match(migration, /2026-08-24\s+13:31:00\s*\+00/i)
assert.match(migration, /THEN\s+NULL/i)
assert.doesNotMatch(migration, /filled_count\s*=/i, 'workflow correction must preserve actual KPI progress')

console.log('KPI July missed workflow contract tests passed')
