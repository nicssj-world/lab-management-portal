import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

for (const path of [
  'components/ui/ModuleSubnav.tsx',
  'components/ui/ViewTabs.tsx',
  'components/ui/FilterChips.tsx',
  'components/layout/RouteBreadcrumbs.tsx',
  'lib/navigation.ts',
]) {
  assert.ok(existsSync(resolve(process.cwd(), path)), `creates ${path}`)
}

const moduleSubnav = read('components/ui/ModuleSubnav.tsx')
assert.ok(moduleSubnav.includes('<nav'), 'module sub-navigation uses semantic nav')
assert.ok(moduleSubnav.includes('aria-current'), 'module sub-navigation exposes the current page')
assert.ok(moduleSubnav.includes('scroll={false}'), 'module links preserve the page scroll position')

const viewTabs = read('components/ui/ViewTabs.tsx')
assert.ok(viewTabs.includes('URLSearchParams'), 'view tabs preserve unrelated query parameters')
assert.ok(viewTabs.includes('scroll={false}'), 'view tabs do not jump to the top')

const filterChips = read('components/ui/FilterChips.tsx')
assert.ok(filterChips.includes('aria-pressed'), 'filter chips expose pressed state')
assert.ok(!filterChips.includes('role="tablist"'), 'filter chips are not announced as tabs')

const layout = read('app/(protected)/layout.tsx')
assert.ok(layout.includes('href="#main-content"'), 'provides a skip link')
assert.ok(layout.includes('id="main-content"'), 'provides a skip-link target')
assert.ok(layout.includes('<RouteBreadcrumbs'), 'renders route-aware breadcrumbs')

console.log('navigation primitive tests passed')
