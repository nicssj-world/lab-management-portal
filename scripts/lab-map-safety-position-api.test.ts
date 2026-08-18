import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const path = 'app/api/admin/lab-map/safety-assets/[id]/position/route.ts'
const route = existsSync(path) ? readFileSync(path, 'utf8') : ''
const verificationPath = 'app/api/admin/lab-map/safety-assets/[id]/position/verify/route.ts'
const verification = existsSync(verificationPath) ? readFileSync(verificationPath, 'utf8') : ''

assert.match(route, /requireSafetyEditor/)
assert.match(route, /safetyAssetPositionSchema/)
assert.match(route, /position_status:\s*'unverified'/)
assert.match(route, /position_verified_by:\s*null/)
assert.match(route, /status:\s*409/)
assert.match(route, /\.eq\('updated_at', parsed\.data\.updatedAt\)/)
assert.doesNotMatch(route, /auditSafety|audit_log|auditWarning/, 'moving safety equipment never creates an activity-log entry or an audit warning')

assert.match(verification, /requireSafetyEditor/, 'position verification requires a safety editor')
assert.match(verification, /safetyAssetPositionVerificationSchema/, 'position verification validates only the optimistic-concurrency token')
assert.match(verification, /position_status:\s*'verified'/, 'position verification marks the location as verified')
assert.match(verification, /position_verified_by:\s*guard\.actor\.id/, 'position verification records the verifying actor')
assert.match(verification, /position_verified_at:/, 'position verification records the verification time')
assert.match(verification, /\.eq\('updated_at', parsed\.data\.updatedAt\)/, 'position verification protects against stale edits')
assert.match(verification, /status: 409/, 'position verification reports stale edits')
assert.doesNotMatch(verification, /photo|inspection/i, 'position verification must not depend on inspection evidence')

console.log('lab map safety position API contract passed')
