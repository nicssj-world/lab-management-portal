import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const migrationPath = fs
  .readdirSync(path.resolve('supabase/migrations'))
  .find((file) => /^\d+_kpi_baseline_fy2569_backfill\.sql$/.test(file))

assert.ok(migrationPath, 'the FY2569 baseline backfill migration must exist')

const migration = fs.readFileSync(path.resolve('supabase/migrations', migrationPath), 'utf8')

assert.match(migration, /fiscal_year\s*=\s*2569/i)
assert.match(migration, /month\s*=\s*7/i)
assert.match(migration, /status\s*=\s*'on_time'/i)
assert.match(migration, /status_source\s*=\s*'baseline'/i)
assert.match(migration, /2026-08-24\s+13:31:00\s*\+00/i)
assert.match(migration, /first_completed_at\s*=\s*'2026-08-24\s+13:31:00\s*\+00'::timestamptz/i)
assert.doesNotMatch(migration, /filled_count\s*=\s*required_count/i, 'backfill must preserve actual KPI progress')
assert.doesNotMatch(migration, /month\s+in\s*\([^)]*1[^)]*9/i, 'older untracked months must not receive completion history')

console.log('KPI baseline backfill contract tests passed')
