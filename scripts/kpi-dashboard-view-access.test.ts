import assert from 'node:assert/strict'
import fs from 'node:fs'

const migrationPath = 'supabase/migrations/20260824143000_kpi_dashboard_view_access.sql'
assert.ok(fs.existsSync(migrationPath), 'dashboard view access repair migration must exist')

const migration = fs.readFileSync(migrationPath, 'utf8')
assert.match(
  migration,
  /alter\s+view\s+public\.vw_kpi_dashboard\s+set\s*\(\s*security_invoker\s*=\s*false\s*\)/i,
  'dashboard view must not require authenticated users to read version tables directly',
)
assert.match(migration, /grant\s+select\s+on\s+public\.vw_kpi_dashboard\s+to\s+authenticated\s*,\s*service_role/i)

console.log('KPI dashboard view access contract tests passed')
