import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const repositorySource = readFileSync('lib/chemical-safety/repository.ts', 'utf8')
const createRouteSource = readFileSync('app/api/admin/chemical-safety/sds/route.ts', 'utf8')
const workflowSource = readFileSync('lib/chemical-safety/sds-workflow.ts', 'utf8')

assert.match(
  repositorySource,
  /source_holding_id/,
  'SDS registry-v2 ต้องกรองสิทธิ์จาก source holding',
)
assert.match(createRouteSource, /chemical_inventory_holdings[\s\S]*?holdingId/)
assert.doesNotMatch(createRouteSource, /\.eq\('storage_scope', 'room'\)/)
assert.match(workflowSource, /source_holding_id/)

console.log('chemical-safety registry SDS visibility contract passed')
