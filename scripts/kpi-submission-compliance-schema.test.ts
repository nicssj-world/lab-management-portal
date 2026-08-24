import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260824125847_kpi_submission_compliance.sql', 'utf8')

for (const table of [
  'kpi_submission_settings',
  'kpi_definition_versions',
  'kpi_submission_periods',
  'kpi_submission_requirements',
]) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`, 'i'), `${table} must be created`)
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), `${table} must enable RLS`)
  assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`, 'i'), `${table} must not be public`)
}

assert.match(migration, /effective_from_fiscal_year/i)
assert.match(migration, /definition_version_id/i)
assert.match(migration, /unique \(dept_id, fiscal_year, month\)/i)
assert.match(migration, /kpi_submission_deadline/i)
assert.match(migration, /reconcile_kpi_submission_period/i)
assert.match(migration, /save_kpi_entries\(/i)
assert.match(migration, /on conflict \(dept_id, kpi_id, fiscal_year, month\) do update/i)
assert.match(migration, /status_source = 'baseline'/i)
assert.match(migration, /drop view if exists public\.vw_kpi_dashboard/i)
assert.match(migration, /security_invoker\s*=\s*true/i)
assert.doesNotMatch(migration, /kpi_submission_settings_id_seq/i, 'boolean settings key must not refer to a sequence')

console.log('KPI submission compliance schema contract tests passed')
