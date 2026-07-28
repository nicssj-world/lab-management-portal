import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const path = 'app/api/admin/lab-map/safety-assets/[id]/position/route.ts'
const route = existsSync(path) ? readFileSync(path, 'utf8') : ''

assert.match(route, /requireSafetyEditor/)
assert.match(route, /safetyAssetPositionSchema/)
assert.match(route, /position_status:\s*'unverified'/)
assert.match(route, /position_verified_by:\s*null/)
assert.match(route, /status:\s*409/)
assert.match(route, /\.eq\('updated_at', parsed\.data\.updatedAt\)/)
assert.doesNotMatch(route, /auditSafety|audit_log|auditWarning/, 'moving safety equipment never creates an activity-log entry or an audit warning')

console.log('lab map safety position API contract passed')
