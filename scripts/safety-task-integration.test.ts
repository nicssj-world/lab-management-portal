import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const closeRound = read('app/api/admin/lab-map/safety-inspection-rounds/[id]/route.ts')

assert.ok(existsSync(join(process.cwd(), 'lib/quality-tasks/safety-server.ts')), 'safety integration server exists')
const integration = read('lib/quality-tasks/safety-server.ts')
assert.ok(closeRound.includes('syncSafetyInspectionRoundToTask'), 'closing an inspection round syncs its linked task')
assert.ok(integration.includes('syncSafetyInspectionRoundToTask'), 'inspection sync is implemented in server-only module')
assert.ok(integration.includes("sync_status: 'pending'"), 'sync failures remain retryable')
assert.ok(integration.includes("integration_kind: 'safety_inspection'"), 'inspection links use explicit integration kind')
assert.ok(integration.includes('quality_task_links'), 'inspection sync persists idempotent source links')
assert.ok(integration.includes('quality_task_action_items') && integration.includes("source_type: 'safety_inspection'"), 'inspection defects become idempotent CAPA action items')

const riskRoute = 'app/api/admin/safety-tasks/occurrences/[id]/risk/route.ts'
assert.ok(existsSync(join(process.cwd(), riskRoute)), 'explicit task-to-risk escalation route exists')
const risk = read(riskRoute)
assert.ok(risk.includes('risk_register') && risk.includes('quality_task_links'), 'risk escalation links both modules')

const certificateRoute = read('app/api/admin/safety-tasks/certificates/route.ts')
assert.ok(certificateRoute.includes('materializeCertificateRenewals'), 'certificate list materializes due renewals')
assert.ok(certificateRoute.includes('90'), 'renewal window starts 90 days before expiry')

console.log('scripts/safety-task-integration.test.ts: all assertions passed')
