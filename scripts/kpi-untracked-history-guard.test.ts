import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const migrationPath = fs
  .readdirSync(path.resolve('supabase/migrations'))
  .find((file) => /^\d+_kpi_untracked_history_guard\.sql$/.test(file))

assert.ok(migrationPath, 'the untracked history guard migration must exist')

const migration = fs.readFileSync(path.resolve('supabase/migrations', migrationPath), 'utf8')

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.keep_untracked_kpi_submission_history_empty/i)
assert.match(migration, /kpi_fiscal_period_key\(NEW\.fiscal_year, NEW\.month\)/i)
assert.match(migration, /tracking_start_fiscal_year/i)
assert.match(migration, /NEW\.first_completed_at\s*:=\s*NULL/i)
assert.match(migration, /NEW\.first_completed_by\s*:=\s*NULL/i)
assert.match(migration, /CREATE TRIGGER[\s\S]*?BEFORE INSERT OR UPDATE/i)
assert.match(migration, /UPDATE public\.kpi_submission_periods/i)
assert.match(migration, /first_completed_at\s*=\s*NULL/i)
assert.doesNotMatch(migration, /last_entry_at\s*=\s*NULL/i, 'last edit history must be preserved')

console.log('KPI untracked history guard contract tests passed')
