import assert from 'node:assert/strict'

async function main() {
  const mod = await import('./authorization-batch').catch(() => null)
  assert.ok(mod, 'authorization batch module should exist')
  assert.equal(typeof mod.expandAuthorizationRows, 'function')
  assert.equal(typeof mod.authorizationRowKey, 'function')

  const rows = mod.expandAuthorizationRows({
    profileIds: ['p1', 'p2'],
    testId: null,
    categories: ['เคมี', 'โลหิต'],
    roles: ['performer', 'approver'],
    common: { authorized_date: '2026-07-25' },
  })
  assert.equal(rows.length, 8)
  assert.equal(new Set(rows.map((row) => mod.authorizationRowKey(row))).size, 8)

  const testRows = mod.expandAuthorizationRows({
    profileIds: ['p1'], testId: 1, categories: [], roles: ['performer', 'performer'], common: {},
  })
  assert.equal(testRows.length, 1)
  assert.deepEqual(testRows[0], { profile_id: 'p1', test_id: 1, category: null, role_type: 'performer' })

  assert.equal(mod.AuthorizationBatchSchema.safeParse({ test_id: null, categories: [], roles: ['performer'] }).success, false)
  assert.equal(mod.AuthorizationBatchSchema.safeParse({ test_id: 1, categories: ['เคมี'], roles: ['performer'] }).success, false)
}

main()
