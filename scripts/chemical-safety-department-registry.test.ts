import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  chemicalDepartmentChemicalProposalSchema,
  chemicalHoldingProposalSchema,
} from '@/lib/chemical-safety/schemas'

const root = process.cwd()
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8')

const migration = read('scripts/chemical-safety-department-registry.sql')
const cliMigration = read('supabase/migrations/20260808154713_chemical_safety_department_registry.sql')
const existingLinkMigration = read('supabase/migrations/20260809074220_link_department_sds_existing_holding.sql')
const registryCrudSql = read('scripts/chemical-safety-registry-crud.sql')
const schemas = read('lib/chemical-safety/schemas.ts')
const types = read('lib/chemical-safety/types.ts')
const route = read('app/api/admin/chemical-safety/department-sds/[code]/register/route.ts')
const sdsOnlyRoute = read('app/api/admin/chemical-safety/department-sds/[code]/register-sds-only/route.ts')
const sdsOnlyMigration = read('supabase/migrations/20260821130000_chemical_sds_only_registry.sql')
const changeRequestsRoute = read('app/api/admin/chemical-safety/change-requests/route.ts')
const changeRequestSubmitRoute = read('app/api/admin/chemical-safety/change-requests/[id]/submit/route.ts')
const sdsMutationRoute = read('app/api/admin/chemical-safety/department-sds/[code]/route.ts')
const sdsReplaceRoute = read('app/api/admin/chemical-safety/department-sds/[code]/replace/route.ts')
const departmentRepository = read('lib/chemical-safety/department-repository.ts')
const sdsClient = read('components/chemical-safety/SdsManagementClient.tsx')
const departmentModal = read('components/chemical-safety/DepartmentChemicalModal.tsx')
const registryClient = read('components/chemical-safety/ChemicalSafetyHubClient.tsx')
const publicModule = read('lib/chemical-safety/public.ts')
const chemicalApi = read('lib/chemical-safety/api.ts')
const existingLinkRoutePath = 'app/api/admin/chemical-safety/department-sds/[code]/link-existing/route.ts'
const existingLinkRoute = existsSync(join(root, existingLinkRoutePath)) ? read(existingLinkRoutePath) : ''

assert.match(migration, /storage_scope/i, 'migration adds an explicit storage scope')
assert.match(migration, /location_id[^\n]*drop not null/i, 'department holdings allow a null location')
assert.match(migration, /chemical_department_chemical_links/i, 'migration adds the department SDS registry link table')
assert.match(migration, /department_sds_id[^\n]*unique/i, 'a department SDS file links to at most one chemical')
assert.match(migration, /entity_type[^\n]*department_chemical/i, 'change requests support department chemicals')
assert.match(migration, /revoke all on public\.chemical_department_chemical_links/i, 'link table is not directly exposed')
assert.match(migration, /grant select, insert, update, delete[\s\S]*chemical_department_chemical_links[\s\S]*to service_role/i, 'service role owns link table access')
assert.match(migration, /department_chemical/i, 'review RPC handles department chemical approval')
assert.match(migration, /location_id\s+is null/i, 'department approval persists no storage location')
assert.match(migration, /chemical_department_sds_file_change_guard/i, 'linked SDS file content cannot be replaced at the database boundary')
assert.equal(cliMigration, migration, 'Supabase CLI migration stays identical to the documented manual migration')
assert.match(
  existingLinkMigration,
  /CREATE OR REPLACE FUNCTION public\.link_department_sds_to_existing_holding\s*\(\s*p_department_sds_id uuid,\s*p_holding_id uuid,\s*p_actor_id uuid\s*\)/i,
  'existing-holding link migration defines the atomic RPC',
)
assert.match(existingLinkMigration, /SECURITY INVOKER SET search_path = ''/i, 'link RPC keeps caller privileges and an empty search path')
for (const guard of [
  'department_sds_not_found',
  'department_sds_file_not_found',
  'department_sds_unit_not_found',
  'department_sds_already_linked',
  'department_holding_not_found',
  'department_holding_wrong_scope',
  'department_holding_wrong_unit',
  'department_holding_inactive',
  'department_holding_already_linked',
]) {
  assert.ok(existingLinkMigration.includes(guard), `link RPC must enforce ${guard}`)
}
assert.match(existingLinkMigration, /INSERT INTO public\.chemical_sds_versions/i, 'link RPC creates an SDS version only when needed')
assert.match(existingLinkMigration, /INSERT INTO public\.chemical_department_chemical_links/i, 'link RPC creates the authoritative department SDS link')
assert.match(existingLinkMigration, /chemical_safety\.department_sds\.link_existing/i, 'link RPC records an audit event')
assert.doesNotMatch(existingLinkMigration, /INSERT INTO public\.chemical_products/i, 'linking an existing holding must not create a product')
assert.doesNotMatch(existingLinkMigration, /INSERT INTO public\.chemical_unit_products/i, 'linking an existing holding must not create a unit-product')
assert.doesNotMatch(existingLinkMigration, /INSERT INTO public\.chemical_inventory_holdings/i, 'linking an existing holding must not create stock')
assert.match(
  existingLinkMigration,
  /REVOKE ALL ON FUNCTION public\.link_department_sds_to_existing_holding\(uuid,uuid,uuid\)[\s\S]*FROM PUBLIC, anon, authenticated/i,
  'link RPC is not executable by browser roles',
)
assert.match(
  existingLinkMigration,
  /GRANT EXECUTE ON FUNCTION public\.link_department_sds_to_existing_holding\(uuid,uuid,uuid\)[\s\S]*TO service_role/i,
  'only the backend service role may execute the link RPC',
)

// Product edit proposals now always carry the GHS fields from the registry form.
// Both the original workflow script and the scope-aware dispatcher migration must
// validate and persist those fields instead of rejecting them as unknown keys.
assert.match(registryCrudSql, /product_keys[\s\S]{0,300}'ghs_source_text'[\s\S]{0,120}'ghs_pictogram_codes'[\s\S]{0,80}'ghs_hazard_classes'/i)
assert.match(registryCrudSql, /ghs_source_text\s*=\s*current_row\.proposed_data->>'ghs_source_text'/i)
assert.match(registryCrudSql, /ghs_pictogram_codes\s*=\s*coalesce\([\s\S]{0,300}jsonb_array_elements_text\(current_row\.proposed_data->'ghs_pictogram_codes'/i)
assert.match(registryCrudSql, /ghs_hazard_classes\s*=\s*current_row\.proposed_data->'ghs_hazard_classes'/i)
for (const sql of [cliMigration]) {
  assert.match(sql, /product_keys[\s\S]{0,300}'ghs_source_text'[\s\S]{0,120}'ghs_pictogram_codes'[\s\S]{0,80}'ghs_hazard_classes'/i)
  assert.match(sql, /ghs_source_text\s*=\s*case[\s\S]{0,240}current_row\.proposed_data->>'ghs_source_text'/i)
  assert.match(sql, /ghs_pictogram_codes\s*=\s*case[\s\S]{0,400}jsonb_array_elements_text\(current_row\.proposed_data->'ghs_pictogram_codes'/i)
  assert.match(sql, /ghs_hazard_classes\s*=\s*case[\s\S]{0,180}current_row\.proposed_data->'ghs_hazard_classes'/i)
}
assert.match(cliMigration, /review_chemical_product_change_request/i, 'scope-aware migration has a GHS-aware product review path')
assert.match(cliMigration, /entity_type\s*=\s*'product'[\s\S]{0,240}review_chemical_product_change_request/i, 'dispatcher routes product changes through the GHS-aware path')
assert.match(chemicalApi, /invalid_product_snapshot/i, 'invalid product snapshots return a specific transition error')

assert.match(types, /export type ChemicalStorageScope\s*=\s*'room'\s*\|\s*'department'/i)
assert.match(types, /interface ChemicalRegistryRow[\s\S]*storageScope:\s*ChemicalStorageScope/i)
assert.match(types, /interface ChemicalHoldingDTO[\s\S]*locationId:\s*string\s*\|\s*null/i)
assert.match(schemas, /department_chemical/i, 'schemas accept department chemical proposals')
assert.match(schemas, /storageScope/i, 'holding proposals carry storage scope')

assert.match(route, /department_sds_creation_closed/i, 'the former registration route is closed')
assert.match(sdsOnlyRoute, /requireChemicalCustodian/i, 'SDS-only route checks chemical custodian scope')
assert.match(sdsOnlyRoute, /chemical_units/i, 'SDS-only route resolves the chemical unit server-side')
assert.match(sdsOnlyRoute, /register_department_sds_as_sds_only/i, 'SDS-only route delegates the atomic registry mutation')
assert.match(sdsOnlyRoute, /file_id/i, 'SDS-only route requires an uploaded SDS file')
assert.match(sdsOnlyMigration, /inventory_capture_status/i, 'SDS-only migration stores an explicit capture status')
assert.match(sdsOnlyMigration, /SDS-only/i, 'SDS-only migration carries the user-facing status label')
assert.match(sdsOnlyMigration, /DROP CONSTRAINT IF EXISTS chemical_department_chemical_links_holding_id_key/i, 'one holding may carry multiple department SDS files')
for (const source of [changeRequestsRoute, changeRequestSubmitRoute]) {
  assert.match(source, /proposal-keys/i, 'chemical proposal routes use recursive key conversion')
}
assert.match(sdsMutationRoute, /chemical_department_chemical_links/i, 'linked department SDS files cannot be deleted')
assert.match(sdsReplaceRoute, /chemical_department_chemical_links/i, 'linked department SDS files cannot be replaced')
assert.ok(existingLinkRoute, 'existing-holding link route must exist')
assert.match(existingLinkRoute, /holdingId:\s*z\.string\(\)\.uuid\(\)/, 'link route validates a holding UUID')
assert.match(existingLinkRoute, /requireChemicalCustodian/i, 'link route enforces chemical custodian scope')
assert.match(existingLinkRoute, /chemical_sds_departments/i, 'link route resolves the SDS department server-side')
assert.match(existingLinkRoute, /chemical_units/i, 'link route resolves the active chemical unit server-side')
assert.match(existingLinkRoute, /link_department_sds_to_existing_holding/i, 'link route delegates the atomic mutation to the RPC')
assert.match(existingLinkRoute, /department_holding_already_linked/i, 'link route maps expected RPC conflicts')
assert.doesNotMatch(
  existingLinkRoute,
  /\.from\(['"]chemical_department_chemical_links['"]\)\s*\.insert/,
  'link route must not perform a non-atomic direct link insert',
)

assert.match(departmentRepository, /registryLink/i, 'department SDS DTO exposes registry-link state')
assert.match(sdsClient, /เพิ่มเข้าทะเบียนสารเคมี/i, 'department SDS UI exposes chemical registration')
assert.doesNotMatch(sdsClient, /onClick=\{\(\) => setRegistering\(\{ group \}\)\}/, 'department-level registration shortcut is removed')
assert.match(sdsClient, /storageScope|ไม่มีตำแหน่งจัดเก็บ/i, 'department chemical form has no storage location')
assert.match(sdsClient, /canEditUnitIds/i, 'department registration uses chemical edit scopes')
assert.match(departmentModal, /ghsPictogramCodes/i, 'department chemical form captures GHS details')
assert.match(departmentModal, /packageValue/i, 'department chemical form captures holding details')
assert.match(departmentModal, /locationId:\s*null/i, 'department chemical form submits no storage location')
assert.match(registryClient, /storageScope/i, 'registry UI distinguishes department-scoped rows')
assert.match(registryClient, /holdingId/i, 'registry rows use holding identity for stable keys')
assert.match(publicModule, /storage_scope === 'department'/i, 'public SDS and storage layout skip department holdings')

const validHolding = {
  productId: '00000000-0000-0000-0000-000000000001',
  storageScope: 'department' as const,
  locationId: null,
  packageValue: 500,
  packageUnit: 'mL' as const,
  currentContainerCount: 2,
  minimumStock: 1,
}
assert.equal(chemicalHoldingProposalSchema.safeParse(validHolding).success, true, 'department holding schema accepts a null location')
assert.equal(chemicalHoldingProposalSchema.safeParse({ ...validHolding, storageScope: 'room', locationId: null }).success, false, 'room holding schema still requires a location')
assert.equal(chemicalHoldingProposalSchema.safeParse({ ...validHolding, locationId: '00000000-0000-0000-0000-000000000002' }).success, false, 'department holding schema rejects a location')
assert.equal(chemicalDepartmentChemicalProposalSchema.safeParse({
  ...validHolding,
  sourceDepartmentSdsId: '00000000-0000-0000-0000-000000000003',
  canonicalName: 'Department test chemical',
  aliases: [],
  ghsPictogramCodes: [],
  ghsHazardClasses: [],
}).success, true, 'department chemical proposal schema accepts the full no-location payload')

console.log('chemical-safety department registry contract: ok')
