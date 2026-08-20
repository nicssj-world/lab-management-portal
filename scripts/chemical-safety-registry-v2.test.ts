import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function read(path: string): string {
  assert.ok(existsSync(path), `missing ${path}`)
  return readFileSync(path, 'utf8')
}

const migrationPath = readdirSync('supabase/migrations')
  .map(name => join('supabase/migrations', name))
  .find(path => readFileSync(path, 'utf8').includes('chemical_sds_publications'))
assert.ok(migrationPath, 'a Supabase migration must create chemical_sds_publications')

const migration = read(migrationPath!)
assert.doesNotMatch(
  migration,
  /CREATE\s+TEMP(?:ORARY)?\s+TABLE\s+chemical_registry_v2_migration_counts/i,
  'migration count snapshots must survive SQL runners that commit each statement',
)
assert.match(
  migration,
  /CREATE TABLE IF NOT EXISTS public\.chemical_registry_v2_migration_counts/i,
  'migration must use a durable, retry-safe count snapshot helper',
)
assert.match(
  migration,
  /DROP TABLE IF EXISTS public\.chemical_registry_v2_migration_counts/i,
  'migration must remove its durable count snapshot helper after verification',
)
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.chemical_sds_publications/i)
assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_chemical_sds_publications_active_destination/i)
for (const required of [
  'workflow_origin',
  'source_holding_id',
  'chemical_sds_publications',
  'link_chemical_sds_publication',
  'set_chemical_sds_department_publication_status',
  "status = 'active'",
  'ENABLE ROW LEVEL SECURITY',
  'FROM PUBLIC, anon, authenticated',
  'TO service_role',
  'chemical_registry_v2_migration_counts',
  "SET public_eligible = false",
]) {
  assert.ok(migration.includes(required), `registry-v2 migration must include ${required}`)
}
assert.match(migration, /CREATE UNIQUE INDEX[\s\S]*product_id[\s\S]*unit_id[\s\S]*destination[\s\S]*WHERE status = 'active'/)
assert.match(migration, /UPDATE public\.chemical_inventory_holdings[\s\S]*workflow_origin = 'legacy'/)
assert.match(migration, /UPDATE public\.chemical_sds_versions[\s\S]*workflow_origin = 'legacy'/)
assert.doesNotMatch(migration, /\b435\b/, 'migration must compare live counts instead of hard-coding the current file count')
assert.match(migration, /chemical_sds_departments[\s\S]*status = 'draft'[\s\S]*published_by = NULL[\s\S]*published_at = NULL/)
assert.match(migration, /workflow_origin = 'legacy' OR source_holding_id IS NOT NULL/)
assert.ok(migration.includes("'chemical-sds-product:'"), 'review and link RPCs must share a product lock')
assert.match(migration, /target_storage_scope = 'department'[\s\S]*chemical_sds_departments[\s\S]*department_sds_unit_not_found/)
assert.doesNotMatch(
  migration,
  /source_holding_id\s*=\s*COALESCE\(source_holding_id,\s*NEW\.holding_id\)/,
  'legacy department associations must keep using all link rows for authorization',
)

const sdsRoute = read('app/api/admin/chemical-safety/sds/route.ts')
assert.ok(sdsRoute.includes('holdingId'), 'SDS creation must be anchored to a holding')
assert.doesNotMatch(sdsRoute, /\.eq\('storage_scope', 'room'\)/, 'department holdings must be allowed to create SDS drafts')

const changeRequestRoute = read('app/api/admin/chemical-safety/change-requests/route.ts')
assert.ok(changeRequestRoute.includes('registry_entry_required'), 'the retired new_chemical creation path must be closed')

const changeRequestSubmitRoute = read('app/api/admin/chemical-safety/change-requests/[id]/submit/route.ts')
assert.ok(
  changeRequestSubmitRoute.includes('chemicalRegistryEntryProposalSchema'),
  'registry entries must keep their discriminated schema when edited or submitted',
)
assert.match(
  migration,
  /entity_type = 'registry_entry'[\s\S]*status = 'approved'[\s\S]*entity_id IS NOT NULL/,
  'approved registry requests must be allowed to store the created holding id',
)

const workflow = read('lib/chemical-safety/sds-workflow.ts')
assert.ok(workflow.includes('source_holding_id'), 'SDS authorization must use the source holding')

const publicationRoute = read('app/api/admin/chemical-safety/registry/[holdingId]/sds-publication/route.ts')
assert.ok(publicationRoute.includes('chemicalSdsPublicationSchema'))
assert.ok(publicationRoute.includes("rpc('link_chemical_sds_publication'"))
assert.ok(publicationRoute.includes('requireChemicalCustodian'))
assert.ok(!publicationRoute.includes('destination:'), 'the route must not accept a client-selected destination')

const legacyUpload = read('app/api/admin/chemical-safety/department-sds/[code]/upload/route.ts')
assert.ok(legacyUpload.includes('legacy_creation_closed'))
assert.ok(legacyUpload.includes('{ status: 409 }'))

const departmentPublish = read('app/api/admin/chemical-safety/department-sds/[code]/publish/route.ts')
assert.ok(departmentPublish.includes("rpc('set_chemical_sds_department_publication_status'"))
assert.doesNotMatch(departmentPublish, /\.from\('chemical_sds_departments'\)\s*\.update/)

const hub = read('components/chemical-safety/ChemicalSafetyHubClient.tsx')
assert.ok(hub.includes('SdsEditorModal'), 'the registry must stay the only place SDS content is edited')
assert.ok(hub.includes('openSds'), 'the registry must open the SDS editor per holding')
assert.ok(hub.includes('publicationStatus'), 'registry rows must display publication state')

const departmentSds = read('components/chemical-safety/SdsManagementClient.tsx')
assert.ok(!departmentSds.includes('DepartmentSdsUploadModal'), 'direct creation of new legacy files must be removed')
assert.ok(departmentSds.includes('แก้ไขชื่อ') && departmentSds.includes('แทนที่ไฟล์'), 'legacy maintenance must remain')

const publicRepository = read('lib/chemical-safety/public.ts')
assert.ok(publicRepository.includes('chemical_sds_publications'), 'public SDS results must include registry-v2 publications')
assert.ok(publicRepository.includes("status', 'active'"), 'public queries must exclude stale publications')
assert.ok(publicRepository.includes('activeRoomPublicationKeys'), 'active room publications must replace matching legacy cards')

console.log('chemical-safety registry v2 implementation contract passed')

