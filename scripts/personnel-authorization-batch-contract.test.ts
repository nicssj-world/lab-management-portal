import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const routePath = resolve('app/api/admin/personnel/[id]/authorizations/batch/route.ts')
assert.equal(existsSync(routePath), true, 'single-profile authorization batch route should exist')

const route = readFileSync(routePath, 'utf8')
const bulk = readFileSync(resolve('app/api/admin/personnel/bulk/route.ts'), 'utf8')

assert.match(route, /AuthorizationBatchSchema/)
assert.match(route, /authorizationRowKey/)
assert.match(route, /skipped/)
assert.match(bulk, /AuthorizationBatchSchema/)
assert.match(bulk, /skipped/)
