import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const resources = read('lib/permission-resources.ts')
const sidebar = read('components/layout/StaffSidebar.tsx')
const topbar = read('components/layout/StaffTopbar.tsx')
const dashboard = read('components/quality-tasks/QualityTaskDashboard.tsx')
const staffDashboard = read('app/(protected)/staff/dashboard/page.tsx')
const occurrenceRoute = read('app/api/admin/quality-tasks/occurrences/[id]/route.ts')
const permissionSeed = read('scripts/seed-role-permissions.sql')
const icons = read('components/ui/Icon.tsx')
const actionItemsRoute = read('app/api/admin/quality-tasks/occurrences/[id]/action-items/route.ts')
const actionItemRoute = read('app/api/admin/quality-tasks/occurrences/[id]/action-items/[itemId]/route.ts')

assert.ok(resources.includes("'งานคุณภาพ'"), 'permission resource is registered')
assert.ok(sidebar.includes("href: '/staff/quality-tasks'"), 'sidebar links to quality tasks')
assert.ok(sidebar.includes("'/staff/quality-tasks/registry'"), 'sidebar links to registry')
assert.ok(topbar.includes("'/staff/quality-tasks':     { th: 'งานคุณภาพ'"), 'topbar names the quality tasks module')
assert.ok(topbar.includes("'/staff/quality-tasks/registry': { th: 'ทะเบียนกิจกรรมคุณภาพ'"), 'topbar names the quality task registry')
assert.ok(dashboard.includes('qt-calendar'), 'module renders a responsive monthly calendar')
assert.ok(dashboard.includes('งานของฉัน'), 'module provides My Tasks scope')
assert.ok(dashboard.includes('attachments/presign') && dashboard.includes('attachments/finalize'), 'dashboard uses direct R2 upload flow')
assert.ok(staffDashboard.includes('qualityUrgent') && staffDashboard.includes('/staff/quality-tasks'), 'staff dashboard links urgent quality tasks')
assert.ok(occurrenceRoute.includes("z.literal('complete')") && occurrenceRoute.includes("z.literal('reopen')"), 'occurrence API exposes guarded workflow actions')
assert.ok(permissionSeed.includes("('Manager', 'งานคุณภาพ:edit'"), 'role reset seed preserves manager edit access')
assert.ok(permissionSeed.includes("('Assistant', 'งานคุณภาพ:view'"), 'role reset seed preserves viewer access')
assert.ok(icons.includes('calendar:'), 'quality-task navigation has a real calendar icon')
assert.ok(dashboard.includes('ผู้รับผิดชอบทุกคน') && dashboard.includes('ทุกทีม'), 'dashboard exposes explicit assignee and team filters')
assert.ok(dashboard.includes('/history'), 'detail card loads audit history')
assert.match(dashboard, /method:\s*["']DELETE["']/, 'edit users can delete eligible evidence from the detail card')
assert.match(dashboard, /mode:\s*["']adHoc["']/, 'edit users can create occurrences from manual templates')
assert.ok(dashboard.includes('สถานที่/ช่องทาง'), 'ad-hoc meeting form captures the location or meeting channel')
assert.ok(dashboard.includes('ผู้เข้าร่วม'), 'ad-hoc meeting form exposes participant selection')
assert.ok(dashboard.includes('วัตถุประสงค์/วาระ'), 'ad-hoc meeting form captures the meeting agenda')
assert.ok(dashboard.includes('ACTION ITEMS'), 'meeting detail card shows an action items section')
assert.ok(dashboard.includes('action-items'), 'dashboard calls the action items API')
assert.ok(actionItemsRoute.includes('qualityTaskContext') && actionItemRoute.includes('qualityTaskContext'), 'action item routes go through the shared quality-task auth context')
assert.ok(actionItemsRoute.includes('listActionItems') && actionItemsRoute.includes('createActionItem'), 'action items collection route lists and creates')
assert.ok(actionItemRoute.includes('updateActionItem') && actionItemRoute.includes('deleteActionItem'), 'action item item route updates and deletes')


// การประชุม vs กิจกรรม ต้องแยกกันได้โดยไม่พึ่งสี — พื้นการ์ด, สไตล์แถบซ้าย และไอคอนนำ ต้องคงอยู่ครบ
assert.ok(dashboard.includes('qt-card-meeting') && dashboard.includes('qt-card-activity'), 'calendar cards carry a task-kind class')
assert.ok(dashboard.includes('border-left-style:dashed'), 'activity cards differ from meetings by border style, not colour alone')
assert.match(dashboard, /TASK_KIND_META[\s\S]{0,240}?meeting:[\s\S]{0,120}?icon: "users"/, 'meeting cards keep a distinct leading glyph')
assert.match(dashboard, /TASK_KIND_META[\s\S]{0,240}?activity:[\s\S]{0,120}?icon: "clipboard"/, 'activity cards carry their own leading glyph')
assert.ok(dashboard.includes('qt-kind-legend'), 'calendar explains its two card kinds with a legend')

// รายการด้านล่างปฏิทิน: เข้าถึงด้วยคีย์บอร์ดได้ เรียงลำดับได้ และไม่เรียกงานทุกชนิดว่า "กิจกรรม"
assert.ok(dashboard.includes('งานทั้งหมด ('), 'list heading covers both task kinds, not just activities')
assert.ok(!dashboard.includes('กิจกรรมทั้งหมด'), 'list heading no longer collides with the activity task kind')
assert.ok(dashboard.includes('qt-row-btn'), 'table rows are reachable through a real button, not a bare clickable <tr>')
assert.ok(dashboard.includes('aria-sort'), 'sortable columns announce their sort state')
assert.ok(dashboard.includes('LIST_COLUMNS') && dashboard.includes('URGENCY_ORDER'), 'list columns and status ordering live in one place')
assert.ok(!dashboard.includes('#0E7490'), 'list cells use design tokens instead of hardcoded hex')

console.log('scripts/quality-task-ui.test.ts: all assertions passed')
