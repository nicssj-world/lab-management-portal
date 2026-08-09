import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const sidebar = read('components/layout/StaffSidebar.tsx')
const topbar = read('components/layout/StaffTopbar.tsx')

assert.ok(existsSync(join(process.cwd(), 'app/(protected)/staff/safety/page.tsx')), 'safety dashboard route exists')
assert.ok(existsSync(join(process.cwd(), 'app/(protected)/staff/safety/registry/page.tsx')), 'safety registry route exists')
assert.ok(existsSync(join(process.cwd(), 'components/safety-tasks/SafetyTaskHub.tsx')), 'safety hub client exists')

const hub = read('components/safety-tasks/SafetyTaskHub.tsx')
for (const tab of ['ภาพรวม', 'รายการงาน', 'ปฏิทิน', 'หลักฐานประจำปี', 'ใบรับรอง']) {
  assert.ok(hub.includes(tab), `safety hub renders ${tab} tab`)
}
assert.ok(hub.includes('role="tablist"') && hub.includes('aria-selected'), 'tabs expose accessible semantics')
assert.ok(hub.includes('safety-agenda') && hub.includes('@media(max-width:767px)'), 'mobile defaults to agenda-friendly layout')
assert.ok(hub.includes('pending_review') && hub.includes('รอตรวจทาน'), 'UI renders approval state with text')
assert.ok(hub.includes('หลักฐานที่ต้องมี') && hub.includes('CAPA'), 'detail drawer contains evidence checklist and CAPA')
assert.ok(hub.includes('/api/admin/safety-tasks'), 'client calls safety-only APIs')

assert.ok(sidebar.includes("href: '/staff/safety'"), 'sidebar links to safety task hub')
assert.ok(sidebar.includes("'/staff/safety/registry'"), 'sidebar links Safety Editors to registry')
assert.ok(topbar.includes("'/staff/safety':"), 'topbar names safety task hub')
assert.ok(topbar.includes("'/staff/safety/registry':"), 'topbar names safety registry')

for (const route of [
  'app/api/admin/safety-tasks/occurrences/route.ts',
  'app/api/admin/safety-tasks/occurrences/[id]/route.ts',
  'app/api/admin/safety-tasks/templates/route.ts',
  'app/api/admin/safety-tasks/certificates/route.ts',
]) assert.ok(existsSync(join(process.cwd(), route)), `${route} exists`)

console.log('scripts/safety-task-ui.test.ts: all assertions passed')
