import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const migrationPath = fs
  .readdirSync(path.resolve('supabase/migrations'))
  .find((file) => /^\d+_kpi_untracked_first_completion_cleanup\.sql$/.test(file))

assert.ok(migrationPath, 'the untracked first-completion cleanup migration must exist')

const migration = fs.readFileSync(path.resolve('supabase/migrations', migrationPath), 'utf8')

assert.match(migration, /UPDATE\s+public\.kpi_submission_periods/i)
assert.match(migration, /fiscal_year\s*=\s*2569/i)
assert.match(migration, /month\s+between\s+1\s+and\s+6/i)
assert.match(migration, /month\s+between\s+10\s+and\s+12/i)
assert.match(migration, /first_completed_at\s*=\s*NULL/i)
assert.match(migration, /first_completed_by\s*=\s*NULL/i)
assert.match(migration, /status\s*=\s*'not_tracked'/i)
assert.doesNotMatch(migration, /last_entry_at\s*=\s*NULL/i, 'last edit history must be preserved')

console.log('KPI untracked history cleanup contract tests passed')
