import assert from 'node:assert/strict'

import { buildCatalogFilterUrl } from '../lib/catalog/filter-url'

assert.equal(
  buildCatalogFilterUrl({ search: 'CBC', categoryId: '', tube: '' }),
  '/catalog?search=CBC',
)

assert.equal(
  buildCatalogFilterUrl({ search: '  CBC  ', categoryId: '', tube: '' }),
  '/catalog?search=CBC',
)

assert.equal(
  buildCatalogFilterUrl({ search: '', categoryId: '', tube: '' }),
  '/catalog',
  'clearing the search box should remove the stale search query from the current history entry',
)

const filteredUrl = buildCatalogFilterUrl({
  search: '',
  categoryId: 'chemistry',
  tube: 'EDTA (ม่วง)',
  openId: null,
})
const filtered = new URL(filteredUrl, 'https://example.test')

assert.equal(filtered.pathname, '/catalog')
assert.equal(filtered.searchParams.get('search'), null)
assert.equal(filtered.searchParams.get('cat'), 'chemistry')
assert.equal(filtered.searchParams.get('tube'), 'EDTA (ม่วง)')

const openUrl = buildCatalogFilterUrl({
  search: 'CBC',
  categoryId: '',
  tube: '',
  openId: 42,
})
const open = new URL(openUrl, 'https://example.test')

assert.equal(open.pathname, '/catalog')
assert.equal(open.searchParams.get('search'), 'CBC')
assert.equal(open.searchParams.get('open'), '42')

console.log('catalog filter URL tests passed')
