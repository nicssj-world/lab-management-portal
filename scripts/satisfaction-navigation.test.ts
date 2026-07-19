import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => {
  const fullPath = join(process.cwd(), path)
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : ''
}

const resources = read('lib/permission-resources.ts')
const sidebar = read('components/layout/StaffSidebar.tsx')
const topbar = read('components/layout/StaffTopbar.tsx')
const seed = read('scripts/seed-role-permissions.sql')
const page = read('app/(protected)/staff/satisfaction/page.tsx')
const module = read('components/satisfaction/SatisfactionModule.tsx')
const navigation = read('lib/navigation.ts')
const server = read('lib/surveys/server.ts')

assert.ok(resources.includes("'แบบสำรวจความพึงพอใจ'"), 'registers the permission resource')
assert.ok(sidebar.includes("href: '/staff/satisfaction'"), 'adds the staff navigation item')
assert.ok(sidebar.includes("resource: 'แบบสำรวจความพึงพอใจ'"), 'guards navigation by resource')
assert.match(sidebar, /staff\/satisfaction[^\n]+icon: '(chart|clipboard)'/)
assert.ok(topbar.includes("'/staff/satisfaction'"), 'adds the topbar title')
assert.ok(seed.includes('แบบสำรวจความพึงพอใจ:edit'), 'seeds edit permission')
assert.ok(seed.includes('แบบสำรวจความพึงพอใจ:view'), 'seeds view permission')

assert.ok(page.includes('getActor'), 'checks the actor')
assert.ok(page.includes('getPermissionLevel'), 'checks module permission')
assert.ok(page.includes("'แบบสำรวจความพึงพอใจ'"), 'checks the exact resource')
assert.ok(page.includes("redirect('/staff/dashboard')"), 'redirects denied users')
assert.ok(page.includes('Promise.all'), 'loads initial lists in parallel')
assert.ok(page.includes('<SatisfactionModule'), 'renders the client shell')

for (const label of ['ภาพรวม', 'แบบสำรวจ', 'รอบเก็บข้อมูล', 'ความคิดเห็น']) {
  assert.ok(navigation.includes(label), `registers ${label} navigation destination`)
}
assert.ok(module.includes("level === 'edit'"), 'shows mutations only to editors')
assert.ok(module.includes('<ModuleSubnav'), 'uses semantic route-backed module navigation')
assert.ok(module.includes('activeSection'), 'renders the route-selected section')
assert.ok(server.includes('export async function listSurveys'))
assert.ok(server.includes('export async function listCampaigns'))

console.log('satisfaction navigation tests passed')
