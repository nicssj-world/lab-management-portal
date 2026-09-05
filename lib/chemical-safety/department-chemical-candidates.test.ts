import assert from 'node:assert/strict'
import { filterDepartmentChemicalCandidates } from './department-chemical-candidates'

const products = [
  { id: 'room-only', lifecycleStatus: 'active' as const },
  { id: 'department-only', lifecycleStatus: 'active' as const },
  { id: 'room-and-department', lifecycleStatus: 'active' as const },
  { id: 'retired-department', lifecycleStatus: 'retired' as const },
]

const holdings = [
  { productId: 'room-only', storageScope: 'room' as const },
  { productId: 'department-only', storageScope: 'department' as const },
  { productId: 'room-and-department', storageScope: 'room' as const },
  { productId: 'room-and-department', storageScope: 'department' as const },
  { productId: 'retired-department', storageScope: 'department' as const },
]

assert.deepEqual(
  filterDepartmentChemicalCandidates(products, holdings).map(product => product.id),
  ['department-only', 'room-and-department'],
  'existing-chemical options must include active department holdings and exclude room-only holdings',
)

assert.deepEqual(
  filterDepartmentChemicalCandidates(products, []).map(product => product.id),
  [],
  'a product with no department holding must not be offered as an existing department chemical',
)

console.log('department chemical candidates: ok')
