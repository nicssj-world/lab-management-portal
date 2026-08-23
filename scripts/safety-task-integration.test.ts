import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const closeRound = read('app/api/admin/lab-map/safety-inspection-rounds/[id]/route.ts')
const hub = read('components/safety-tasks/SafetyTaskHub.tsx')
const roundApi = read('app/api/admin/lab-map/safety-inspection-rounds/route.ts')
const assetsPage = read('app/(protected)/staff/lab-map/safety-assets/page.tsx')
const assetsClient = read('components/lab-map/SafetyAssetsClient.tsx')
const safetyServer = read('lib/quality-tasks/safety-server.ts')

assert.ok(existsSync(join(process.cwd(), 'lib/quality-tasks/safety-server.ts')), 'safety integration server exists')
const integration = read('lib/quality-tasks/safety-server.ts')
assert.ok(closeRound.includes('syncSafetyInspectionRoundToTask'), 'closing an inspection round syncs its linked task')
assert.ok(integration.includes('syncSafetyInspectionRoundToTask'), 'inspection sync is implemented in server-only module')
assert.ok(integration.includes("sync_status: 'pending'"), 'sync failures remain retryable')
assert.ok(integration.includes("integration_kind: 'safety_inspection'"), 'inspection links use explicit integration kind')
assert.ok(integration.includes('quality_task_links'), 'inspection sync persists idempotent source links')
assert.ok(integration.includes('quality_task_action_items') && integration.includes("source_type: 'safety_inspection'"), 'inspection defects become idempotent CAPA action items')
assert.match(integration, /closedKinds/, 'the linked task receives per-kind round closure state')
assert.match(hub, /ประเภทอุปกรณ์/, 'the linked task shows inspection progress by equipment kind')
assert.match(hub, /\/staff\/lab-map\/safety-assets\?inspectionRound=/, 'Safety task links open the inspection registry with the round selected')
assert.match(hub, /href="\/staff\/lab-map\/safety-assets"/, 'Safety hub links directly to the safety asset registry')
assert.match(hub, /ปิดรอบและส่งงาน/, 'a complete but unsynced inspection tells the user to close and submit the round')
assert.doesNotMatch(hub, /PENDING · ปิดรอบตรวจ/, 'the inspection result badge does not mix status with an action')
assert.match(hub, /integration\.syncStatus === 'synced' \? 'SYNCED' : 'PENDING'/, 'the inspection result badge shows one unambiguous sync status')
assert.match(assetsClient, /href="\/staff\/safety"/, 'Safety asset registry links back to the Safety task hub')
assert.match(roundApi, /searchParams\.get\('roundId'\)/, 'inspection round API can load the requested round')
assert.match(assetsPage, /searchParams/, 'inspection registry page accepts a round deep link')
assert.match(assetsClient, /initialInspectionRoundId/, 'inspection registry client receives a round deep link')
assert.match(integration, /filter_snapshot: \{[^}]*query: ''[^}]*status: ''[^}]*kind: ''[^}]*spaceCode: ''/, 'task-created rounds use the registry filter contract')
assert.match(safetyServer, /lab_map_safety_inspections/, 'annual Safety evidence reads field inspection photos')
assert.match(safetyServer, /sourceKind: 'inspection'/, 'field inspection photos are marked as evidence items')
assert.match(hub, /downloadHref/, 'the evidence tab supports both task files and inspection photos')

const riskRoute = 'app/api/admin/safety-tasks/occurrences/[id]/risk/route.ts'
assert.ok(existsSync(join(process.cwd(), riskRoute)), 'explicit task-to-risk escalation route exists')
const risk = read(riskRoute)
assert.ok(risk.includes('risk_register') && risk.includes('quality_task_links'), 'risk escalation links both modules')

const certificateRoute = read('app/api/admin/safety-tasks/certificates/route.ts')
assert.ok(certificateRoute.includes('materializeCertificateRenewals'), 'certificate list materializes due renewals')
assert.ok(certificateRoute.includes('90'), 'renewal window starts 90 days before expiry')

console.log('scripts/safety-task-integration.test.ts: all assertions passed')
