import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const modal = readFileSync('components/chemical-safety/RegistryChangeModal.tsx', 'utf8')
const submitRoute = readFileSync('app/api/admin/chemical-safety/change-requests/[id]/submit/route.ts', 'utf8')
const api = readFileSync('lib/chemical-safety/api.ts', 'utf8')

assert.match(
  modal,
  /departmentProductIds/,
  'the existing-chemical selector must receive department-scoped product ids',
)
assert.match(
  modal,
  /storageScope === 'department'/,
  'the existing-chemical selector must apply the department scope when filtering options',
)
assert.match(
  submitRoute,
  /storage_scope[\s\S]*department/,
  'the submit route must validate that an existing department product has a department holding',
)
assert.match(
  submitRoute,
  /department_product_not_available/,
  'the submit route must reject a room-only product selected as a department chemical',
)
assert.match(
  api,
  /department_product_not_available/,
  'the API must return a user-facing validation response for a room-only product',
)

console.log('chemical-safety department scope contract passed')
