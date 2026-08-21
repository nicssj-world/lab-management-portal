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
  assert.match(
    departmentRepository,
    /lot_number, package_value, package_unit, current_container_count/,
    'department SDS registry candidates must include holding details for explicit selection',
  )
  assert.match(
    departmentRepository,
    /chemical_inventory_holdings'[\s\S]{0,220}storage_scope[\s\S]{0,120}\.eq\('storage_scope', 'department'\)/,
    'department SDS registry candidates must exclude room-scoped holdings',
  )
  assert.match(
    departmentRepository,
    /chemical_products'[\s\S]{0,120}lifecycle_status/,
    'department SDS repository must load lifecycle status without hiding names of already-linked inactive products',
  )
  assert.match(
    departmentRepository,
    /activeProductIds[\s\S]{0,1600}!activeProductIds\.has\(productId\)/,
    'department SDS registry candidates must exclude inactive products',
  )
  assert.match(
    departmentRepository,
    /findRegisteredDepartmentChemicals/,
    'department SDS repository must retain every matching holding instead of choosing one implicitly',
  )
  assert.match(
    departmentRepository,
    /candidates:/,
    'department SDS registry-link DTO must expose matching holdings',
  )
  assert.match(
    departmentRepository,
    /availableToLink:\s*true/,
    'a holding may carry multiple department SDS files in the current link workflow',
  )
  console.log('chemical-safety department registry repository: ok')
}

void main()
