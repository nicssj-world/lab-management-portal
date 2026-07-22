import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = (path: string) => resolve(process.cwd(), path)
const read = (path: string) => readFileSync(file(path), 'utf8')

for (const path of [
  'app/(protected)/staff/eqa/[section]/page.tsx',
  'app/(protected)/staff/outlab/[section]/page.tsx',
  // ความเสี่ยงแยกเป็น 3 ระบบที่มีวงจรชีวิตต่างกัน จึงใช้ route ของตัวเองแทน [section] เดิม
  'app/(protected)/staff/risk/report/page.tsx',
  'app/(protected)/staff/risk/ior/page.tsx',
  'app/(protected)/staff/risk/register/page.tsx',
  'app/(protected)/staff/risk/smart-rm/page.tsx',
  'app/(protected)/staff/satisfaction/surveys/page.tsx',
  'app/(protected)/staff/satisfaction/campaigns/page.tsx',
  'app/(protected)/staff/satisfaction/comments/page.tsx',
]) {
  assert.ok(existsSync(file(path)), `creates route ${path}`)
}

for (const path of [
  'components/eqa/EqaDashboard.tsx',
  'components/outlab/OutlabDashboard.tsx',
  'components/satisfaction/SatisfactionModule.tsx',
]) {
  const source = read(path)
  assert.ok(source.includes('activeSection'), `${path} receives its active route section`)
  assert.ok(source.includes('<ModuleSubnav'), `${path} renders shared module navigation`)
}

// แต่ละหน้าของโมดูลความเสี่ยงเป็น client ของตัวเอง จึงรู้ว่าตัวเองคือหน้าไหนจาก route ตรง ๆ
for (const path of [
  'components/risk/RiskOverview.tsx',
  'components/risk/IncidentClient.tsx',
  'components/risk/RegisterClient.tsx',
  'components/risk/SmartRmClient.tsx',
]) {
  assert.ok(read(path).includes('<ModuleSubnav'), `${path} renders shared module navigation`)
}

// หน้ารายงานอุบัติการณ์ต้องเปิดให้เจ้าหน้าที่ทุกคน จึงห้ามผูกกับ permission matrix
const reportPage = read('app/(protected)/staff/risk/report/page.tsx')
assert.ok(!reportPage.includes("=== 'none'"), 'incident reporting stays open to every signed-in staff member')

const sidebar = read('components/layout/StaffSidebar.tsx')

// ลูกที่ชี้ไปหน้ารายงานต้องไม่มี resource
assert.ok(
  /\{ href: '\/staff\/risk\/report'[^}]*\}/.test(sidebar) && !/\{ href: '\/staff\/risk\/report'[^}]*resource:/.test(sidebar),
  'sidebar exposes incident reporting without a resource gate',
)

// แม่ของกลุ่มก็ต้องไม่มี resource — isEntryVisible เช็คของแม่ก่อนแล้ว return false
// ก่อนจะดูลูกเลย ถ้าใส่กลับเข้าไป ลูกจะหายไปด้วยสำหรับคนที่ไม่มีสิทธิ์เข้าทะเบียน
const riskGroupHeader = sidebar.slice(
  sidebar.indexOf("{ href: '/staff/risk',       th:"),
  sidebar.indexOf("children: [", sidebar.indexOf("{ href: '/staff/risk',       th:")),
)
assert.ok(riskGroupHeader.length > 0, 'risk navigation is a submenu group')
assert.ok(
  !riskGroupHeader.includes('resource:'),
  'risk group parent must stay ungated so the incident-report child survives for users without register access',
)

const outlabPage = read('app/(protected)/staff/outlab/page.tsx')
assert.ok(outlabPage.includes("legacyTab === 'certificates'"), 'recognizes the legacy OUTLAB certificate tab')
assert.ok(outlabPage.includes("redirect(`/staff/outlab/certificates"), 'redirects the legacy tab to its canonical nested route')

const navigationDefinitions = read('lib/navigation.ts')
assert.ok(navigationDefinitions.includes("href: '/staff/eqa/settings'"), 'defines EQA settings in the central navigation map')
assert.ok(navigationDefinitions.includes("href: '/staff/outlab/settings'"), 'defines OUTLAB settings in the central navigation map')
for (const path of ['components/eqa/EqaDashboard.tsx', 'components/outlab/OutlabDashboard.tsx']) {
  assert.ok(read(path).includes("item.id !== 'settings' || isAdmin"), `${path} filters settings navigation by permission`)
}

const topbar = read('components/layout/StaffTopbar.tsx')
assert.ok(topbar.includes('resolvePageTitle'), 'topbar uses the shared longest-route title resolver')

console.log('navigation route tests passed')
