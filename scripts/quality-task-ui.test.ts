import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const resources = read('lib/permission-resources.ts')
const sidebar = read('components/layout/StaffSidebar.tsx')
const dashboard = read('components/quality-tasks/QualityTaskDashboard.tsx')
const attention = read('components/dashboard/AttentionQueue.tsx')
const occurrenceRoute = read('app/api/admin/quality-tasks/occurrences/[id]/route.ts')
const permissionSeed = read('scripts/seed-role-permissions.sql')
const icons = read('components/ui/Icon.tsx')

assert.ok(resources.includes("'งานคุณภาพ'"), 'permission resource is registered')
assert.ok(sidebar.includes("href: '/staff/quality-tasks'"), 'sidebar links to quality tasks')
assert.ok(sidebar.includes("'/staff/quality-tasks/registry'"), 'sidebar links to registry')
assert.ok(dashboard.includes('qt-calendar'), 'module renders a responsive monthly calendar')
assert.ok(dashboard.includes('งานของฉัน'), 'module provides My Tasks scope')
assert.ok(dashboard.includes('attachments/presign') && dashboard.includes('attachments/finalize'), 'dashboard uses direct R2 upload flow')
assert.ok(attention.includes('งานคุณภาพ') && attention.includes('/staff/quality-tasks'), 'staff attention queue links urgent quality tasks')
assert.ok(occurrenceRoute.includes("z.literal('complete')") && occurrenceRoute.includes("z.literal('reopen')"), 'occurrence API exposes guarded workflow actions')
assert.ok(permissionSeed.includes("('Manager', 'งานคุณภาพ:edit'"), 'role reset seed preserves manager edit access')
assert.ok(permissionSeed.includes("('Assistant', 'งานคุณภาพ:view'"), 'role reset seed preserves viewer access')
assert.ok(icons.includes('calendar:'), 'quality-task navigation has a real calendar icon')
assert.ok(dashboard.includes('ผู้รับผิดชอบทุกคน') && dashboard.includes('ทุกทีม'), 'dashboard exposes explicit assignee and team filters')
assert.ok(dashboard.includes('/history'), 'detail card loads audit history')
assert.ok(dashboard.includes("method:'DELETE'"), 'edit users can delete eligible evidence from the detail card')
assert.ok(dashboard.includes("mode:'adHoc'"), 'edit users can create occurrences from manual templates')

console.log('scripts/quality-task-ui.test.ts: all assertions passed')
