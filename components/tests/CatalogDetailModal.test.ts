import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'components/tests/CatalogDetailModal.tsx'), 'utf8')

assert.match(source, /catalog-detail-modal-title-row/)
assert.match(source, /\.catalog-detail-modal-action-row \{[\s\S]*justify-content: space-between;/)
assert.match(source, /catalog-detail-modal-kicker[\s\S]*catalog-detail-modal-header-content[\s\S]*catalog-detail-modal-action-row/)
assert.match(source, /catalog-detail-modal-action-row[\s\S]*catalog-detail-modal-full-link[\s\S]*catalog-detail-modal-close/)
const closeStyles = source.match(/\.catalog-detail-modal-close \{([\s\S]*?)\r?\n        \}/)?.[1]
assert.ok(closeStyles)
assert.match(closeStyles, /background: var\(--danger\);/)
assert.match(closeStyles, /color: #fff;/)
assert.match(closeStyles, /border: 1px solid var\(--danger\);/)

console.log('components/tests/CatalogDetailModal.test.ts: all assertions passed')
