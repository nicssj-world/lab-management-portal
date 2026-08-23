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
const registry = read('components/safety-tasks/SafetyTaskRegistry.tsx')
const qualityPage = read('app/(protected)/staff/quality-tasks/page.tsx')
const qualityDashboard = read('components/quality-tasks/QualityTaskDashboard.tsx')
const certificateDialog = hub.slice(hub.indexOf('function CertificateDialog'), hub.indexOf('function EvidenceUploadDialog'))
for (const tab of ['ภาพรวม', 'รายการงาน', 'ปฏิทิน', 'หลักฐานประจำปี', 'ใบรับรอง']) {
  assert.ok(hub.includes(tab), `safety hub renders ${tab} tab`)
}
assert.ok(hub.includes('role="tablist"') && hub.includes('aria-selected'), 'tabs expose accessible semantics')
assert.ok(hub.includes('safety-agenda') && hub.includes('@media(max-width:767px)'), 'mobile defaults to agenda-friendly layout')
assert.ok(hub.includes('pending_review') && hub.includes('รอตรวจทาน'), 'UI renders approval state with text')
assert.ok(hub.includes('หลักฐานที่ต้องมี') && hub.includes('CAPA'), 'detail drawer contains evidence checklist and CAPA')
assert.ok(hub.includes('/api/admin/safety-tasks'), 'client calls safety-only APIs')
assert.ok(certificateDialog.includes('const [dragOver, setDragOver] = useState(false)'), 'certificate upload tracks drag-over state')
assert.match(certificateDialog, /onDrop=\{event => \{[\s\S]*event\.dataTransfer\.files\?\.\[0\][\s\S]*setFile\(dropped\)/, 'certificate upload accepts dropped files')
assert.ok(certificateDialog.includes('aria-label="เลือกไฟล์ใบรับรอง"'), 'certificate drop zone labels its file picker')
assert.ok(certificateDialog.includes('ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์'), 'certificate drop zone explains click and drag interactions')
assert.ok(certificateDialog.includes('เอาไฟล์ออก'), 'certificate drop zone lets users clear a selected file')
const monthlyInspectionBoard = read('components/safety-tasks/MonthlySafetyInspectionBoard.tsx')
assert.ok(monthlyInspectionBoard.includes('เตือนล่วงหน้า 5 วัน'), 'monthly safety inspections warn five days before the due date')
assert.ok(hub.includes("import { PageHeader } from '@/components/ui/PageHeader'"), 'safety hub uses the shared Staff PageHeader')
assert.ok(registry.includes("import { PageHeader } from '@/components/ui/PageHeader'"), 'safety registry uses the shared Staff PageHeader')
assert.doesNotMatch(hub, /\.safety-shell\{[^}]*max-width/, 'safety hub must not center content in a max-width container')
assert.doesNotMatch(registry, /\.safety-registry\{[^}]*max-width/, 'safety registry must not center content in a max-width container')
assert.match(hub, /\.safety-shell\{[^}]*font-size:13px/, 'safety hub uses the Staff body type scale')
assert.match(registry, /\.safety-registry\{[^}]*font-size:13px/, 'safety registry uses the Staff body type scale')
assert.ok(hub.includes('index % 7 === 0 || index % 7 === 6'), 'calendar identifies Sunday and Saturday cells')
assert.ok(hub.includes('safety-weekday is-weekend'), 'calendar highlights weekend headings')
assert.ok(hub.includes('safety-day is-weekend'), 'calendar highlights weekend date cells')
assert.ok(hub.includes('.safety-weekday.is-weekend') && hub.includes('.safety-day.is-weekend'), 'weekend classes have explicit visual styling')
assert.match(hub, /\.safety-days button\{[^}]*font-weight:700/, 'calendar task labels use a readable bold weight')
assert.match(hub, /function openTask[\s\S]+setSelected\(item\)/, 'linked Safety meeting opens the local detail drawer')
assert.doesNotMatch(hub, /function openTask[\s\S]{0,260}window\.location\.assign/, 'opening linked meeting details must not leave the Safety page')
assert.ok(hub.includes('การประชุมนี้ใช้ข้อมูลหลักจากงานคุณภาพ') && hub.includes('ไปจัดการในงานคุณภาพ'), 'linked meeting drawer identifies the Quality source and offers an explicit management link')
assert.ok(qualityPage.includes('task?: string') && qualityPage.includes('month?: string'), 'Quality Tasks accepts calendar deep links')
assert.ok(qualityDashboard.includes('initialSelectedKey') && qualityDashboard.includes('initialOccurrences.find'), 'Quality Tasks opens the linked canonical occurrence')
assert.ok(registry.includes('async function remove('), 'registry implements Master Task removal')
assert.ok(registry.includes("method: 'DELETE'"), 'registry calls the Safety Master Task DELETE API')
assert.ok(registry.includes('แก้ไข Master Task'), 'registry exposes an explicit edit action')
assert.ok(registry.includes('ลบ Master Task'), 'registry exposes an explicit delete action')
assert.ok(registry.includes('หากมีประวัติงาน ระบบจะปิดใช้งานและเก็บประวัติไว้'), 'delete confirmation explains history-safe archival')

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
