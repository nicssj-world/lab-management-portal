import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = (path: string) => resolve(process.cwd(), path)
const read = (path: string) => readFileSync(file(path), 'utf8')

for (const path of [
  'app/(protected)/staff/eqa/[section]/page.tsx',
  'app/(protected)/staff/outlab/[section]/page.tsx',
  'app/(protected)/staff/risk/[section]/page.tsx',
  'app/(protected)/staff/satisfaction/surveys/page.tsx',
  'app/(protected)/staff/satisfaction/campaigns/page.tsx',
  'app/(protected)/staff/satisfaction/comments/page.tsx',
]) {
  assert.ok(existsSync(file(path)), `creates route ${path}`)
}

for (const path of [
  'components/eqa/EqaDashboard.tsx',
  'components/outlab/OutlabDashboard.tsx',
  'components/risk/RiskClient.tsx',
  'components/satisfaction/SatisfactionModule.tsx',
]) {
  const source = read(path)
  assert.ok(source.includes('activeSection'), `${path} receives its active route section`)
  assert.ok(source.includes('<ModuleSubnav'), `${path} renders shared module navigation`)
}

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
