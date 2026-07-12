import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'app/(public)/catalog/[code]/page.tsx'), 'utf8')

assert.doesNotMatch(source, /RefRangeModal|isJsonTable|ค่าอ้างอิง/)
assert.match(source, /catalog-detail-note/)
assert.match(source, /หมายเหตุ/)
assert.match(source, /<SpecimenSection test=\{test\} showNote=\{false\} \/>/)
assert.match(source, /<Icon name="doc"/)
assert.match(source, /<Icon name="phone"/)

console.log('catalog page layout test: all assertions passed')
