import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const serverPath = 'lib/quality-tasks/monthly-safety-server.ts'
assert.ok(existsSync(join(process.cwd(), serverPath)), 'monthly safety server repository exists')
const server = read(serverPath)

for (const name of [
  'materializeMonthlySafetyInspections',
  'listMonthlySafetyPoints',
  'getMonthlySafetyForm',
  'submitMonthlySafetyInspection',
  'updateMonthlySafetyPointWorkflow',
]) assert.ok(server.includes(`function ${name}`) || server.includes(`function ${name}<`), `${name} is implemented`)

// ค่าจริงอยู่ใน MONTHLY_SAFETY_SOURCE_KEYS ของ lib/quality-tasks/monthly-safety.ts
// (ที่เดียว เพราะฝั่ง client ใช้ค่าเดียวกันซ่อนปุ่มเริ่มรอบตรวจของหน้าอุปกรณ์)
assert.match(server, /source_key', \[\.\.\.MONTHLY_SAFETY_SOURCE_KEYS\]/, 'materialization is limited to the two approved parent tasks')
assert.match(read('lib/quality-tasks/monthly-safety.ts'), /MONTHLY_SAFETY_SOURCE_KEYS = \['CBH-ST-04', 'CBH-ST-26'\]/, 'the approved parent tasks are CBH-ST-04 and CBH-ST-26')
assert.ok(server.includes('assignee_snapshot'), 'round items snapshot point assignees')
assert.ok(server.includes('template_snapshot'), 'round items snapshot the form version and supplies')
assert.ok(server.includes('actor.id') && server.includes('isEditor'), 'access uses the authenticated actor and editor flag')
assert.ok(server.includes("source_type: 'monthly_safety'"), 'abnormal submissions create a sourced CAPA')
assert.ok(server.includes("onConflict: 'instance_id,source_type,source_id'"), 'CAPA creation is idempotent')
assert.ok(server.includes("status: 'completed'") && server.includes("status: 'in_progress'"), 'parent state follows point progress')
assert.ok(server.includes('audit_log'), 'workflow changes are audited')

const listRoute = read('app/api/admin/safety-tasks/monthly-inspections/route.ts')
assert.ok(listRoute.includes("safetyTaskContext('view')"), 'list route requires a signed-in Safety viewer')
assert.ok(listRoute.includes('monthSchema'), 'list route validates month input')

const itemRoute = read('app/api/admin/safety-tasks/monthly-inspections/[roundItemId]/route.ts')
assert.ok(itemRoute.includes('getMonthlySafetyForm') && itemRoute.includes('updateMonthlySafetyPointWorkflow'), 'item route reads and updates a point')
assert.ok(itemRoute.includes("safetyTaskContext('edit')"), 'skip/reassign requires Safety Editor')

const submitRoute = read('app/api/admin/safety-tasks/monthly-inspections/[roundItemId]/submit/route.ts')
assert.ok(submitRoute.includes("safetyTaskContext('view')"), 'assigned viewers can submit')
assert.ok(submitRoute.includes('discriminatedUnion'), 'submit payload is a discriminated union')

console.log('monthly safety API contract passed')
