import assert from 'node:assert/strict'
import { summarizeChemicalRegistry } from './registry-summary'

const summary = summarizeChemicalRegistry([
  { productId: 'alcohol', holdingId: 'holding-blood-bank', storageScope: 'department' },
  { productId: 'alcohol', holdingId: 'holding-microbiology', storageScope: 'department' },
  { productId: 'acetone', holdingId: 'holding-room', storageScope: 'room' },
])

assert.deepEqual(summary, {
  productCount: 2,
  registryEntryCount: 3,
  roomEntryCount: 1,
  departmentEntryCount: 2,
})

console.log('chemical-safety registry summary: ok')
