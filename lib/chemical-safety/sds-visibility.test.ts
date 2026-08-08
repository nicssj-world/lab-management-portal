import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { roomChemicalProductIds } from './sds-visibility'

assert.deepEqual(
  [...roomChemicalProductIds([
    { product_id: 'room-product', unit_id: 'unit-a', storage_scope: 'room' },
    { product_id: 'department-product', unit_id: 'unit-a', storage_scope: 'department' },
    { product_id: 'other-room-product', unit_id: 'unit-b', storage_scope: 'room' },
  ])].sort(),
  ['other-room-product', 'room-product'],
  'SDS ห้องสารเคมีต้องไม่รวม product ที่มีเฉพาะ holding ระดับงาน',
)
assert.deepEqual(
  [...roomChemicalProductIds([
    { product_id: 'room-product', unit_id: 'unit-a', storage_scope: 'room' },
    { product_id: 'other-room-product', unit_id: 'unit-b', storage_scope: 'room' },
  ], 'unit-a')],
  ['room-product'],
  'ตัวกรองหน่วยงานของ SDS ห้องสารเคมีต้องกรองจาก holding ในห้อง',
)

const repositorySource = readFileSync('lib/chemical-safety/repository.ts', 'utf8')
const createRouteSource = readFileSync('app/api/admin/chemical-safety/sds/route.ts', 'utf8')
const workflowSource = readFileSync('lib/chemical-safety/sds-workflow.ts', 'utf8')

assert.match(
  repositorySource,
  /roomChemicalProductIds\(snapshot\.holdings, filters\.unitId\)/,
  'SDS ห้องสารเคมีต้องจำกัดรายการด้วย holding ที่อยู่ในห้องสารเคมี',
)
assert.match(createRouteSource, /chemical_inventory_holdings[\s\S]*?storage_scope[\s\S]*?room/)
assert.match(workflowSource, /chemical_inventory_holdings[\s\S]*?storage_scope[\s\S]*?room/)

console.log('chemical-safety room SDS visibility contract passed')
