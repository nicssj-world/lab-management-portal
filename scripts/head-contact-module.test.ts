import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isProtectedPath } from '../lib/auth/session-guard'

const read = (path: string) => {
  const full = join(process.cwd(), path)
  return existsSync(full) ? readFileSync(full, 'utf8') : ''
}

const sql = read('scripts/head-contact-module.sql')
const publicRoute = read('app/api/head-contact/[token]/route.ts')
const publicPage = read('app/h/[token]/page.tsx')
const staffPage = read('app/(protected)/staff/it/head-contact/page.tsx')
const staffItemRoute = read('app/api/admin/head-contact/[id]/route.ts')
const settingsRoute = read('app/api/admin/head-contact/settings/route.ts')
const unitsRoute = read('app/api/admin/head-contact/units/route.ts')
const unitRoute = read('app/api/admin/head-contact/units/[id]/route.ts')
const sidebar = read('components/layout/StaffSidebar.tsx')
const topbar = read('components/layout/StaffTopbar.tsx')
const authProfile = read('lib/auth/profile.ts')

for (const table of ['head_contact_form_settings', 'head_contact_service_units', 'head_contact_submissions']) {
  assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `creates ${table}`)
  assert.match(sql, new RegExp(`REVOKE ALL ON ${table} FROM anon, authenticated`, 'i'))
}
assert.ok(sql.includes('งานเคมีคลินิก'), 'seeds the legacy service units')
assert.ok(sql.includes('service_unit_snapshot'), 'preserves the submitted unit name')
for (const index of [
  'head_contact_form_settings_updated_by_idx',
  'head_contact_service_units_updated_by_idx',
  'head_contact_submissions_updated_by_idx',
  'head_contact_submissions_closed_by_idx',
]) assert.ok(sql.includes(index), `creates foreign-key index ${index}`)

assert.equal(isProtectedPath('/h/example'), false)
assert.equal(isProtectedPath('/staff/it/head-contact'), true)
assert.ok(publicPage.includes('<PublicHeadContactForm'))
assert.ok(publicRoute.includes('verifyHeadContactChallenge'))
assert.ok(publicRoute.includes('content-length'))
assert.ok(publicRoute.includes('consumeRateLimit'))
assert.ok(publicRoute.includes('submissionKey'))

for (const source of [staffPage, staffItemRoute, settingsRoute, unitsRoute, unitRoute]) {
  assert.ok(source.includes('requireHeadContactAccess'), 'protected head-contact surfaces use the shared guard')
}
assert.ok(staffItemRoute.includes('canDeleteHeadContact'))
assert.ok(staffItemRoute.includes('status: 403'))

assert.ok(sidebar.includes("href: '/staff/it/head-contact'"))
assert.ok(sidebar.includes("deptRole: 'group_lead'"))
const mainSectionStart = sidebar.indexOf("{ section: 'งานหลัก' }")
const safetySectionStart = sidebar.indexOf("{ section: 'งานความเสี่ยงและความปลอดภัย' }")
const itSectionStart = sidebar.indexOf("{ section: 'งาน IT' }")
assert.ok(mainSectionStart >= 0 && safetySectionStart > mainSectionStart)
assert.match(sidebar.slice(mainSectionStart, safetySectionStart), /^  \{ href: '\/staff\/it\/head-contact'/m)
assert.ok(!sidebar.slice(itSectionStart, sidebar.indexOf("{ section: 'Analytics' }")).includes("'/staff/it/head-contact'"))
assert.ok(topbar.includes("'/staff/it/head-contact'"))
assert.ok(authProfile.includes('dept_role'), 'protected layout profile carries the department role')

console.log('head contact module tests passed')
