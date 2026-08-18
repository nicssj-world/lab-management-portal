import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const migrationPath = 'supabase/migrations/20260819090000_chemical_safety_holding_delete_unlink.sql'
assert.ok(existsSync(migrationPath), `missing ${migrationPath}`)

const migration = readFileSync(migrationPath, 'utf8')
const unlinkIndex = migration.search(/delete\s+from\s+public\.chemical_department_chemical_links/i)
const holdingDeleteIndex = migration.search(/delete\s+from\s+public\.chemical_inventory_holdings/i)

assert.ok(unlinkIndex >= 0, 'holding deletion must remove the department registry link in the same transaction')
assert.ok(holdingDeleteIndex >= 0, 'holding deletion function must still delete the holding')
assert.ok(unlinkIndex < holdingDeleteIndex, 'department registry link must be removed before the holding')
assert.match(
  migration,
  /where\s+link\.holding_id\s*=\s*current_row\.entity_id/i,
  'only the link for the requested holding may be removed',
)
assert.doesNotMatch(migration, /delete\s+from\s+public\.chemical_sds_(versions|publications)/i)
assert.match(migration, /holding_in_use_cannot_delete/i)
assert.match(migration, /notify\s+pgrst,\s*'reload schema';\s*commit;/i)

console.log('chemical safety holding-delete migration contract passed')
