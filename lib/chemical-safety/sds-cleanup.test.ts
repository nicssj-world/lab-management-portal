import assert from 'node:assert/strict'
import { buildSdsCleanupPlan } from './sds-cleanup'

const plan = buildSdsCleanupPlan({
  versions: [
    { id: 'legacy-room', product_id: 'p-room', source_holding_id: null, status: 'approved', file_id: 'file-room' },
    { id: 'legacy-department', product_id: 'p-both', source_holding_id: null, status: 'draft', file_id: null },
    { id: 'direct-department', product_id: 'p-dept', source_holding_id: 'h-dept', status: 'draft', file_id: null },
  ],
  holdings: [
    { id: 'h-room', product_id: 'p-room', storage_scope: 'room' },
    { id: 'h-both-room', product_id: 'p-both', storage_scope: 'room' },
    { id: 'h-both-dept', product_id: 'p-both', storage_scope: 'department' },
    { id: 'h-dept', product_id: 'p-dept', storage_scope: 'department' },
  ],
  departmentLinks: [],
  products: [
    { id: 'p-room', canonical_name: 'Room chemical' },
    { id: 'p-both', canonical_name: 'Shared product' },
    { id: 'p-dept', canonical_name: 'Department product' },
  ],
})

assert.deepEqual(plan.assignments, [{
  versionId: 'legacy-room',
  holdingId: 'h-room',
  productId: 'p-room',
  productName: 'Room chemical',
  status: 'approved',
  fileId: 'file-room',
  reason: 'unique_room_holding',
}])
assert.deepEqual(plan.ambiguous.map(row => row.versionId), ['legacy-department'])
assert.deepEqual(plan.resolved, { room: 1, department: 1 })
assert.equal(plan.errors.length, 0)

const linkedDepartmentPlan = buildSdsCleanupPlan({
  versions: [
    { id: 'linked-version', product_id: 'p-shared', source_holding_id: null, status: 'draft' },
  ],
  holdings: [
    { id: 'h-shared-room', product_id: 'p-shared', storage_scope: 'room' },
    { id: 'h-shared-dept', product_id: 'p-shared', storage_scope: 'department' },
  ],
  departmentLinks: [{ sds_version_id: 'linked-version', holding_id: 'h-shared-dept' }],
  products: [{ id: 'p-shared', canonical_name: 'Linked department product' }],
})

assert.deepEqual(linkedDepartmentPlan.resolved, { room: 0, department: 1 })
assert.equal(linkedDepartmentPlan.assignments.length, 0)
assert.equal(linkedDepartmentPlan.ambiguous.length, 0)

const invalidSourcePlan = buildSdsCleanupPlan({
  versions: [
    { id: 'invalid-source', product_id: 'p-one', source_holding_id: 'h-other', status: 'approved' },
  ],
  holdings: [{ id: 'h-other', product_id: 'p-two', storage_scope: 'room' }],
  departmentLinks: [],
  products: [
    { id: 'p-one', canonical_name: 'Wrong source product' },
    { id: 'p-two', canonical_name: 'Actual source product' },
  ],
})

assert.equal(invalidSourcePlan.errors.length, 1)
assert.match(invalidSourcePlan.errors[0], /product mismatch/)
assert.equal(invalidSourcePlan.assignments.length, 0)

console.log('chemical SDS cleanup planner tests passed')
