import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const path = 'app/api/admin/lab-map/safety-assets/[id]/position/route.ts'
const route = existsSync(path) ? readFileSync(path, 'utf8') : ''

assert.match(route, /requireSafetyEditor/)
assert.match(route, /safetyAssetPositionSchema/)
assert.match(route, /position_status:\s*'unverified'/)
assert.match(route, /position_verified_by:\s*null/)
assert.match(route, /status:\s*409/)
assert.match(route, /auditSafety\('lab_map\.safety_asset\.position'/)
assert.match(route, /\.eq\('updated_at', parsed\.data\.updatedAt\)/)
assert.match(route, /auditWarning/, 'an audit outage after a successful write must not make the client roll back persisted coordinates')

console.log('lab map safety position API contract passed')
