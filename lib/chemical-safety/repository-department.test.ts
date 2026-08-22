import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'

async function main() {
  const { mapChemicalPlacement } = await import('./registry-row')
  const departmentRepository = readFileSync('lib/chemical-safety/department-repository.ts', 'utf8')
  const placement = mapChemicalPlacement(
    { storage_scope: 'department', location_id: null },
    undefined,
  )

  assert.equal(placement.storageScope, 'department')
  assert.equal(placement.locationId, null)
  assert.equal(placement.positionCode, null)
  assert.match(readFileSync('lib/chemical-safety/repository.ts', 'utf8'), /mapChemicalPlacement\(holding, location\)/)
  assert.match(readFileSync('lib/chemical-safety/repository.ts', 'utf8'), /reportedTotalRaw: text\(holding\.reported_total_raw\)/)
  assert.match(readFileSync('lib/chemical-safety/repository.ts', 'utf8'), /filters\.roomId && room\?\.id !== filters\.roomId/)
  assert.match(readFileSync('lib/chemical-safety/repository.ts', 'utf8'), /roomId: room\?\.id == null \? null : String\(room\.id\)/)
  assert.match(
    readFileSync('lib/chemical-safety/repository.ts', 'utf8'),
    /raw_data[\s\S]*packageRaw/,
    'registry packing size must fall back to the survey raw package value',
  )

  const repositorySource = readFileSync('lib/chemical-safety/repository.ts', 'utf8')
  assert.doesNotMatch(
    repositorySource,
    /importedQuantityStatus\s*===\s*['"]unsupported-unit['"]\s*\?\s*null/,
    'an old unsupported-unit warning must not hide corrected current package fields',
  )
  assert.match(
    repositorySource,
    /const calculated = calculateRegistryQuantity\(\{/,
    'registry rows must calculate from the current holding fields',
  )
  assert.doesNotMatch(
    departmentRepository,
    /findRegisteredDepartmentChemicals|status:\s*'registered'/,
    'department SDS repository must not revive the retired name-matching workflow',
  )
  assert.match(
    departmentRepository,
    /status:\s*'unlinked'|status:\s*'pending'|status:\s*'linked'/,
    'department SDS registry-link DTO must retain only the current workflow states',
  )
  assert.match(
    departmentRepository,
    /buildDepartmentSdsDedupPlan/,
    'department SDS repository must canonicalize duplicate files per holding',
  )
  assert.match(
    departmentRepository,
    /canonicalDepartmentSdsLinkIds/,
    'department SDS repository must show only the canonical link',
  )
  console.log('chemical-safety department registry repository: ok')
}

void main()
