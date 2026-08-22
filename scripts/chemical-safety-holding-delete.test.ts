import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

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

const cascadeMigrationPath = readdirSync('supabase/migrations')
  .find(name => name.includes('chemical_safety_holding_hard_delete_cascade'))
assert.ok(cascadeMigrationPath, 'hard-delete cascade migration must be added')
const cascadeMigration = readFileSync(`supabase/migrations/${cascadeMigrationPath}`, 'utf8')
assert.match(cascadeMigration, /delete_chemical_holding_cascade/i)
assert.match(cascadeMigration, /holding_delete_shared_dependency/i)
assert.match(cascadeMigration, /chemical_sds_files/i)
assert.match(cascadeMigration, /r2_key/i)
assert.match(cascadeMigration, /chemical_products|chemical_unit_products/i)
assert.match(cascadeMigration, /CREATE OR REPLACE FUNCTION public\.delete_chemical_holding_cascade\(\s*p_holding_id uuid,\s*p_actor_id uuid\s*\)[\s\S]*?RETURNS jsonb/i)
assert.match(cascadeMigration, /FOR UPDATE/i, 'cascade locks dependency rows before checking references')
const publicationDeleteIndex = cascadeMigration.search(/delete\s+from\s+public\.chemical_sds_publications/i)
const linkDeleteIndex = cascadeMigration.search(/delete\s+from\s+public\.chemical_department_chemical_links/i)
const versionDeleteIndex = cascadeMigration.search(/delete\s+from\s+public\.chemical_sds_versions/i)
const departmentSdsDeleteIndex = cascadeMigration.search(/delete\s+from\s+public\.chemical_department_sds/i)
const cascadeHoldingDeleteIndex = cascadeMigration.search(/delete\s+from\s+public\.chemical_inventory_holdings/i)
const fileDeleteIndex = cascadeMigration.search(/delete\s+from\s+public\.chemical_sds_files/i)
assert.ok(publicationDeleteIndex >= 0 && linkDeleteIndex > publicationDeleteIndex, 'publications are removed before department links')
assert.ok(linkDeleteIndex >= 0 && versionDeleteIndex > linkDeleteIndex, 'department links are removed before SDS versions')
assert.ok(versionDeleteIndex >= 0 && departmentSdsDeleteIndex > versionDeleteIndex, 'SDS versions are removed before department SDS metadata')
assert.ok(departmentSdsDeleteIndex >= 0 && cascadeHoldingDeleteIndex > departmentSdsDeleteIndex, 'department SDS metadata is removed before holding')
assert.ok(cascadeHoldingDeleteIndex >= 0 && fileDeleteIndex > cascadeHoldingDeleteIndex, 'orphan file metadata is removed after the holding')
assert.doesNotMatch(cascadeMigration, /delete\s+from\s+public\.chemical_(products|unit_products)/i)
assert.match(cascadeMigration, /revoke all on function public\.delete_chemical_holding_cascade\(uuid, uuid\)[\s\S]*?grant execute[\s\S]*?to service_role/i)

console.log('chemical safety holding-delete migration contract passed')
