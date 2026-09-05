import assert from 'node:assert/strict'
import { sdsVersionIdsForHolding } from './sds-visibility'

const resolveSdsForHolding = sdsVersionIdsForHolding as unknown as (
  versions: Array<Record<string, unknown>>,
  departmentLinks: Array<Record<string, unknown>>,
  holdingId: string,
  publications: Array<Record<string, unknown>>,
  holdings: Array<Record<string, unknown>>,
) => Set<string>

const holdings = [
  { id: 'holding-department-a', product_id: 'product-shared', storage_scope: 'department' },
  { id: 'holding-department-b', product_id: 'product-shared', storage_scope: 'department' },
  { id: 'holding-room', product_id: 'product-shared', storage_scope: 'room' },
]

const versions = [
  { id: 'sds-shared', product_id: 'product-shared', source_holding_id: 'holding-department-a' },
]

assert.deepEqual(
  [...resolveSdsForHolding(versions, [], 'holding-department-b', [], holdings)],
  ['sds-shared'],
  'department holdings for the same product must share the SDS file',
)
assert.deepEqual(
  [...resolveSdsForHolding(versions, [], 'holding-room', [], holdings)],
  [],
  'department SDS must not leak into a room holding of the same product',
)

assert.deepEqual(
  [...resolveSdsForHolding(
    [{ id: 'sds-room', product_id: 'product-shared', source_holding_id: 'holding-room' }],
    [],
    'holding-department-b',
    [],
    holdings,
  )],
  [],
  'room SDS must not leak into a department holding of the same product',
)

assert.deepEqual(
  [...resolveSdsForHolding(
    [{ id: 'sds-linked', product_id: 'product-shared', source_holding_id: null }],
    [{ sds_version_id: 'sds-linked', holding_id: 'holding-department-a', product_id: 'product-shared' }],
    'holding-department-b',
    [],
    holdings,
  )],
  ['sds-linked'],
  'legacy department links must share the linked SDS with the other departments',
)

assert.deepEqual(
  [...resolveSdsForHolding(
    [{ id: 'sds-published', product_id: 'product-shared', source_holding_id: null }],
    [],
    'holding-department-b',
    [{ sds_version_id: 'sds-published', source_holding_id: 'holding-department-a', destination: 'department' }],
    holdings,
  )],
  ['sds-published'],
  'department publications must share the SDS with the other departments',
)

console.log('department SDS sharing: ok')
