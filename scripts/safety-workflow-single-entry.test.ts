import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const server = read('lib/quality-tasks/safety-server.ts')
const taskServer = read('lib/quality-tasks/server.ts')
const hub = read('components/safety-tasks/SafetyTaskHub.tsx')
const assets = read('components/lab-map/SafetyAssetsClient.tsx')
const progress = read('components/lab-map/SafetyInspectionProgress.tsx')
const roundApi = read('app/api/admin/lab-map/safety-inspection-rounds/route.ts')
const closeRoundApi = read('app/api/admin/lab-map/safety-inspection-rounds/[id]/route.ts')
const inspectionRoundApi = read('app/api/admin/safety-tasks/occurrences/[id]/inspection-round/route.ts')
const migrationText = readdirSync(join(process.cwd(), 'supabase/migrations'))
  .filter(file => file.endsWith('.sql'))
  .map(file => readFileSync(join(process.cwd(), 'supabase/migrations', file), 'utf8'))
  .join('\n')

assert.ok(existsSync(join(process.cwd(), 'components/safety-tasks/SafetyTaskHub.tsx')), 'Safety Task hub exists')
assert.match(inspectionRoundApi, /openSafetyInspectionRoundFromTask/, 'Task has the canonical round entry endpoint')
assert.match(server, /task_instance_id:\s*instanceId/, 'round items carry the source task instance')
assert.match(server, /formTemplateByProfile/, 'round items resolve the inspection form template')
assert.match(server, /template_id:\s*formTemplateByProfile\.get/, 'round items carry the matching inspection form template')
assert.doesNotMatch(server, /template_id:\s*access\.instance\.template_id/, 'round items do not store a quality task template id in the form-template foreign key')
assert.match(server, /const dueOn = nullable\(access\.instance\.(?:planned_date|period_end)\)/, 'rounds derive a task due date')
assert.match(server, /due_on:\s*dueOn/, 'round items carry the source task due date')
assert.match(migrationText, /quality_task_links_safety_task_instance_key/, 'database prevents duplicate safety rounds for one task instance')
assert.match(migrationText, /round_filter_snapshot[\s\S]{0,220}periodStart/, 'evidence reuse follows the task period')
assert.match(hub, /เริ่มตรวจอุปกรณ์/, 'inspection tasks expose one clear start action')
assert.doesNotMatch(hub, /เปิด Inspection Round/, 'inspection tasks do not expose a second start button')
assert.doesNotMatch(hub, /inspectionTask[\s\S]{0,500}onAction\('submit'\)/, 'inspection tasks cannot be closed from the generic task footer')
assert.match(assets, /เริ่มงานตรวจจากแท็บ “งานความปลอดภัย”/, 'asset map explains the canonical workflow entry')
assert.doesNotMatch(assets, /method:\s*'POST'[\s\S]{0,160}safety-inspection-rounds/, 'asset map does not create scheduled rounds directly')
assert.match(progress, /startHint/, 'inspection progress has a single-entry hint')
assert.match(roundApi, /กรุณาเริ่มรอบตรวจจากหน้า งานความปลอดภัย/, 'direct scheduled round creation is rejected with a useful message')
assert.match(roundApi, /if \(!requestedRoundId\)/, 'asset map does not silently pick an unrelated open round')
assert.doesNotMatch(closeRoundApi, /\.eq\('started_by', guard\.actor\.id\)/, 'any authorized Safety Editor can finish the task-linked round')
assert.match(taskServer, /const inspectionTask[\s\S]{0,500}งานตรวจอุปกรณ์จะปิดอัตโนมัติ/, 'generic task actions protect the inspection workflow')

// Monthly Spill kit / NSS rounds live in the same rounds table. Opening one in the
// asset map records a photo inspection that marks the round item 'completed' without
// submitted_at, which strands the point: the monthly board still shows "ยังไม่ส่ง"
// but neither submit nor skip accepts it any more.
assert.match(roundApi, /filter_snapshot[\s\S]{0,120}monthly_safety/, 'the asset map refuses to open a monthly inspection round')
assert.match(hub, /monthlyRound/, 'monthly rounds do not link into the asset-map inspection flow')

console.log('scripts/safety-workflow-single-entry.test.ts: all assertions passed')
