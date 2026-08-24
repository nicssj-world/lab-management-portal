import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const migrationPath = fs
  .readdirSync(path.resolve('supabase/migrations'))
  .find((file) => /^\d+_kpi_compliance_bulk_reconcile\.sql$/.test(file))

assert.ok(migrationPath, 'the bulk KPI compliance reconcile migration must exist')

const migration = fs.readFileSync(path.resolve('supabase/migrations', migrationPath), 'utf8')
const query = fs.readFileSync('lib/queries/kpi-compliance.ts', 'utf8')

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.reconcile_kpi_submission_periods_bulk/i)
assert.match(migration, /p_fiscal_year\s+integer/i)
assert.match(migration, /p_dept_ids\s+bigint\[\]/i)
assert.match(migration, /reconcile_kpi_submission_period\(/i)
assert.match(migration, /period_id\s+bigint/i)
assert.match(migration, /IF period_id IS NULL/i)
assert.match(migration, /tracking_start_key/i)
assert.match(migration, /REVOKE ALL ON FUNCTION public\.reconcile_kpi_submission_periods_bulk\(/i)
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.reconcile_kpi_submission_periods_bulk\([^)]*\) TO service_role/i)
assert.match(query, /reconcile_kpi_submission_periods_bulk/i)
assert.doesNotMatch(query, /visibleDepartments\.flatMap\(\(dept\) => materializedPeriods\.map\(/i, 'the request must not issue one RPC per matrix cell')

console.log('KPI compliance bulk reconcile performance contract tests passed')
