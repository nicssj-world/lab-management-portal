import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => {
  const full = join(process.cwd(), path)
  return existsSync(full) ? readFileSync(full, 'utf8').replace(/\r\n/g, '\n') : ''
}

const pagePath = 'app/(protected)/staff/it/page.tsx'
const page = read(pagePath)
const sidebar = read('components/layout/StaffSidebar.tsx')
const topbar = read('components/layout/StaffTopbar.tsx')

assert.equal(existsSync(join(process.cwd(), pagePath)), true, 'IT hub route exists')
assert.ok(page.includes("export const dynamic = 'force-dynamic'"), 'hub is rendered dynamically')
assert.ok(page.includes('getPermissionsWithItOverride'), 'hub uses the existing IT permission resolver')
assert.ok(page.includes("redirect('/staff/dashboard')"), 'users without an IT hub card are redirected')

const cardHrefs = [...page.matchAll(/href: '(\/staff\/it\/[^']+)'/g)].map(match => match[1])
assert.deepEqual(cardHrefs, [
  '/staff/it/access',
  '/staff/it/verification',
  '/staff/it/downtime',
  '/staff/it/backup',
], 'hub contains exactly the four IT task links')
assert.doesNotMatch(page, /\/staff\/it\/(?:visitors|head-contact)/, 'moved routes are not hub cards')

for (const route of ['/staff/it/access', '/staff/it/verification', '/staff/it/downtime', '/staff/it/backup']) {
  assert.ok(sidebar.includes(`href: '${route}'`), `${route} remains in navigation`)
}

const itSectionStart = sidebar.indexOf("{ section: 'งาน IT' }")
const analyticsSectionStart = sidebar.indexOf("{ section: 'Analytics' }")
assert.ok(itSectionStart >= 0 && analyticsSectionStart > itSectionStart, 'found the IT section')
const itBlock = sidebar.slice(itSectionStart, analyticsSectionStart)
assert.match(itBlock, /^  \{ href: '\/staff\/it',/m, 'IT parent opens the hub')
assert.match(itBlock, /href: '\/staff\/it',[^\n]*anyResource:/, 'overview is available to verification-only users')
assert.ok(!itBlock.includes("'/staff/it/visitors'"), 'visitor log is absent from IT')
assert.ok(!itBlock.includes("'/staff/it/head-contact'"), 'head contact is absent from IT')

const safetyStart = sidebar.indexOf("{ href: '/staff/safety'")
assert.ok(safetyStart >= 0 && safetyStart < itSectionStart, 'found the Safety group')
const safetyBlock = sidebar.slice(safetyStart, itSectionStart)
assert.ok(safetyBlock.includes("href: '/staff/it/visitors'"), 'visitor log is under Safety')
assert.match(
  safetyBlock,
  /href: '\/staff\/lab-map\/chemicals'[\s\S]*href: '\/staff\/it\/visitors'/,
  'visitor log appears directly below Chemicals & SDS in the Safety menu',
)

const mainStart = sidebar.indexOf("{ section: 'งานหลัก' }")
assert.ok(mainStart >= 0 && mainStart < safetyStart, 'found the main work section')
assert.match(sidebar.slice(mainStart, safetyStart), /^  \{ href: '\/staff\/it\/head-contact'/m, 'head contact is a main-work item')
assert.ok(sidebar.includes("deptRole: 'group_lead'"), 'head contact supports group leads')
assert.ok(topbar.includes("'/staff/it':"), 'topbar has an IT hub title')

console.log('IT hub navigation tests passed')
