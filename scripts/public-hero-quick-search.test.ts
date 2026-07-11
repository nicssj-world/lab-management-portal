import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import {
  buildCatalogOpenUrl,
  buildCatalogSearchUrl,
  buildQuickSearchApiUrl,
  buildTestDetailHref,
  canQuickSearch,
} from '../lib/catalog/quick-search'

assert.equal(canQuickSearch(''), false)
assert.equal(canQuickSearch('a'), false)
assert.equal(canQuickSearch('  CBC  '), true)

assert.equal(buildCatalogSearchUrl(''), '/catalog')
assert.equal(buildCatalogSearchUrl('  CBC  '), '/catalog?search=CBC')

const apiUrl = new URL(buildQuickSearchApiUrl('  CBC  ', 6), 'https://example.test')
assert.equal(apiUrl.pathname, '/api/tests')
assert.equal(apiUrl.searchParams.get('search'), 'CBC')
assert.equal(apiUrl.searchParams.get('page'), '0')
assert.equal(apiUrl.searchParams.get('pageSize'), '6')
assert.equal(apiUrl.searchParams.get('sortBy'), 'th')

assert.equal(buildTestDetailHref({ id: 42 }), '/catalog/42')
assert.equal(buildCatalogOpenUrl({ id: 42 }, '  CBC  '), '/catalog?search=CBC&open=42')
assert.equal(buildCatalogOpenUrl({ id: 42 }, ''), '/catalog?open=42')

assert.ok(existsSync('components/public/PublicHeroSearch.tsx'), 'homepage quick search should live in a focused client component')

const pageSource = readFileSync('app/(public)/page.tsx', 'utf8')
assert.match(pageSource, /import \{ PublicHeroSearch \} from '@\/components\/public\/PublicHeroSearch'/)
assert.match(pageSource, /<PublicHeroSearch \/>/)
assert.doesNotMatch(pageSource, /<form action="\/catalog" method="get" className="public-hero-search"/)

const componentSource = readFileSync('components/public/PublicHeroSearch.tsx', 'utf8')
assert.match(componentSource, /^'use client'/, 'quick search needs client state and event handlers')
assert.match(componentSource, /buildCatalogOpenUrl/, 'quick search item clicks should open the catalog detail card in context')
assert.match(componentSource, /buildQuickSearchApiUrl/, 'quick search should use the shared API URL helper')
assert.doesNotMatch(componentSource, /href=\{buildTestDetailHref\(test\)\}/, 'quick search suggestions should not jump straight to the full detail page')
assert.match(componentSource, /role="listbox"/, 'suggestions should be announced as a selectable result list')
assert.match(componentSource, /ดูผลลัพธ์ทั้งหมด/, 'users should still have a clear path to the full catalog results')
assert.match(componentSource, /รหัส E-phis/, 'quick results should label the visible code as E-phis')
assert.doesNotMatch(componentSource, /รหัสกรมบัญชีกลาง/, 'quick results should not show CGD codes in the compact suggestion row')
assert.match(componentSource, /contact_name/, 'quick results should use the responsible department/contact name to distinguish duplicate test names')
assert.match(componentSource, /public-hero-suggestion-department/, 'department detail should have a small secondary text style')
assert.match(
  componentSource,
  /\.public-hero-suggestions\s*\{[\s\S]*?position:\s*absolute/,
  'suggestions should overlay the LINE/manual cards instead of pushing the hero layout down',
)
assert.match(componentSource, /overflow-y:\s*auto/, 'suggestions should scroll internally when results are taller than the panel')
assert.match(componentSource, /public-hero-search-wrap \$\{showPanel \? 'is-open' : ''\}/, 'open state should mark the wrapper so the hero can allow overlay overflow')

assert.match(
  pageSource,
  /\.public-hero:has\(\.public-hero-search-wrap\.is-open\)\s*\{[\s\S]*?overflow:\s*visible !important/,
  'hero should allow the open suggestion overlay to escape its decorative clipping area',
)

console.log('public hero quick search tests passed')
