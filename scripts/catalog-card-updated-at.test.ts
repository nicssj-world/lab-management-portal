import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const table = read('components/tests/TestTable.tsx')
const catalog = read('app/(public)/catalog/page.tsx')

assert.match(table, /showUpdatedAt\?: boolean/)
assert.match(table, /\{showUpdatedAt &&/)
assert.match(table, /แก้ไขล่าสุด/)
assert.match(table, /Intl\.DateTimeFormat\('th-TH'/)
assert.match(table, /t\.updated_at/)
assert.match(catalog, /showUpdatedAt/)

console.log('catalog card updated-at checks passed')
