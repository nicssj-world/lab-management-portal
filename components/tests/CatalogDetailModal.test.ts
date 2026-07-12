import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'components/tests/CatalogDetailModal.tsx'), 'utf8')

assert.match(source, /catalog-detail-modal-title-row/)
assert.match(source, /\.catalog-detail-modal-actions \{[\s\S]*flex-direction: column;[\s\S]*align-items: flex-end;/)
assert.match(source, /catalog-detail-modal-actions[\s\S]*catalog-detail-modal-close[\s\S]*catalog-detail-modal-full-link/)

console.log('components/tests/CatalogDetailModal.test.ts: all assertions passed')
