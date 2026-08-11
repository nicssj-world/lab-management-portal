import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { roomChemicalSdsVersionIds, sdsVersionIdsForHolding } from './sds-visibility'

assert.deepEqual(
  [...sdsVersionIdsForHolding(
    [
      { id: 'direct-room', product_id: 'product-a', source_holding_id: 'room-holding' },
      { id: 'linked-department', product_id: 'product-b', source_holding_id: null },
      { id: 'shared-department', product_id: 'product-c', source_holding_id: null },
      { id: 'other-department', product_id: 'product-d', source_holding_id: null },
    ],
    [
      { sds_version_id: 'linked-department', holding_id: 'department-holding' },
      { sds_version_id: 'shared-department', holding_id: 'department-holding' },
      { sds_version_id: 'shared-department', holding_id: 'second-department-holding' },
      { sds_version_id: 'other-department', holding_id: 'other-holding' },
    ],
    'department-holding',
  )].sort(),
  ['linked-department', 'shared-department'],
  'ทะเบียนต้อง resolve SDS จาก source holding หรือ department link ของ holding เดียวกันเท่านั้น',
)

assert.deepEqual(
  [...roomChemicalSdsVersionIds(
    [
      { id: 'room-version', product_id: 'room-product', source_holding_id: 'room-holding' },
      { id: 'department-version', product_id: 'department-product', source_holding_id: 'department-holding' },
      { id: 'legacy-room-version', product_id: 'room-product', source_holding_id: null },
      { id: 'legacy-department-version', product_id: 'shared-product', source_holding_id: null },
      { id: 'legacy-ambiguous-version', product_id: 'shared-product', source_holding_id: null },
    ],
    [
      { id: 'room-holding', product_id: 'room-product', unit_id: 'unit-a', storage_scope: 'room' },
      { id: 'department-holding', product_id: 'department-product', unit_id: 'unit-a', storage_scope: 'department' },
      { id: 'shared-room-holding', product_id: 'shared-product', unit_id: 'unit-a', storage_scope: 'room' },
      { id: 'shared-department-holding', product_id: 'shared-product', unit_id: 'unit-a', storage_scope: 'department' },
    ],
    [{ sds_version_id: 'legacy-department-version', holding_id: 'shared-department-holding' }],
  )].sort(),
  ['legacy-room-version', 'room-version'],
  'SDS ห้องสารเคมีต้องไม่รวม SDS ที่เป็นของงานหรือยังระบุปลายทางไม่ได้',
)

const repositorySource = readFileSync('lib/chemical-safety/repository.ts', 'utf8')
const createRouteSource = readFileSync('app/api/admin/chemical-safety/sds/route.ts', 'utf8')
const workflowSource = readFileSync('lib/chemical-safety/sds-workflow.ts', 'utf8')
const pageSource = readFileSync('app/(protected)/staff/lab-map/chemicals/page.tsx', 'utf8')
const hubSource = readFileSync('components/chemical-safety/ChemicalSafetyHubClient.tsx', 'utf8')
const registrySdsModalSource = readFileSync('components/chemical-safety/RegistrySdsWorkflowModal.tsx', 'utf8')

assert.match(
  repositorySource,
  /source_holding_id/,
  'SDS registry-v2 ต้องกรองสิทธิ์จาก source holding',
)
assert.match(createRouteSource, /chemical_inventory_holdings[\s\S]*?holdingId/)
assert.doesNotMatch(createRouteSource, /\.eq\('storage_scope', 'room'\)/)
assert.match(workflowSource, /source_holding_id/)
assert.match(repositorySource, /roomChemicalSdsVersionIds\(snapshot\.sdsVersions, snapshot\.holdings, snapshot\.sdsDepartmentLinks\)/)
assert.match(repositorySource, /const approved = holdingVersions[\s\S]*?item\.status === 'approved'/)
assert.doesNotMatch(repositorySource, /const draft = holdingVersions\.find[\s\S]*\?\? versions\.find/)
assert.match(registrySdsModalSource, /item\.sourceHoldingId === row\.holdingId/)
assert.match(registrySdsModalSource, /item\.linkedHoldingIds\.includes\(row\.holdingId\)/)
assert.match(pageSource, /listInternalSds\(\{\}, 'room'\)/)
assert.match(hubSource, /roomSdsItems/)

console.log('chemical-safety registry SDS visibility contract passed')
