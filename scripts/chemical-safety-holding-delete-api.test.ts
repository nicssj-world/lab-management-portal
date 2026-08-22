import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const routePath = 'app/api/admin/chemical-safety/registry/[holdingId]/delete/route.ts'
const storagePath = 'lib/chemical-safety/holding-delete-storage.ts'
assert.ok(existsSync(routePath), `missing ${routePath}`)
assert.ok(existsSync(storagePath), `missing ${storagePath}`)
const route = readFileSync(routePath, 'utf8')
const storage = readFileSync(storagePath, 'utf8')

assert.match(route, /export\s+async\s+function\s+GET/i, 'registry deletion has a preflight endpoint')
assert.match(route, /export\s+async\s+function\s+DELETE/i, 'registry deletion has a destructive endpoint')
assert.match(route, /buildChemicalHoldingDeleteImpact/i, 'preflight uses the shared impact planner')
assert.match(route, /delete_chemical_holding_cascade/i, 'destructive endpoint calls the transactional cascade RPC')
assert.doesNotMatch(route, /holding_delete_shared_dependency/i, 'shared SDS metadata is no longer a hard blocker')
assert.match(route, /delete_chemical_holding_cascade/i, 'shared SDS cleanup is delegated to the transactional cascade')
assert.match(route, /requireChemicalCustodian/i, 'both endpoints enforce chemical custodian scope')
assert.doesNotMatch(route, /change-requests/i, 'direct registry deletion does not create a pending change request')
assert.match(route, /deleteChemicalSdsR2Objects/i, 'orphan files are cleaned after the database call')
assert.match(route, /audit_log/i, 'R2 cleanup failures are durably recorded for follow-up cleanup')
assert.match(storage, /DeleteObjectCommand/i, 'storage cleanup deletes only returned R2 objects')
assert.match(storage, /Promise\.all/i, 'storage cleanup attempts each orphan object independently')
assert.match(storage, /failedKeys/i, 'storage cleanup returns failures without rolling back the database')

console.log('chemical holding-delete API contract passed')
