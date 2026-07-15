import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'app/(public)/catalog/[code]/page.tsx'), 'utf8')

assert.match(source, /import \{ RefRangeModal \} from '@\/components\/tests\/RefRangeModal'/, 'full page must use the reference-range reveal control')
assert.match(source, /TestReferenceRange/, 'full page must type the reference-range query result')
assert.match(source, /from\('test_reference_ranges'\)\.select\('\*'\)\.eq\('test_id', test\.id\)\.order\('sort_order'\)/, 'full page must fetch the test reference-range rows')
assert.match(source, /const referenceRanges = \(rangesRes\.data \?\? \[\]\) as TestReferenceRange\[\]/, 'full page must retain the fetched reference-range rows')
assert.match(source, /ค่าอ้างอิง \(Reference Range\)/, 'full page must label the reference-range section')
assert.match(source, /<RefRangeModal ranges=\{referenceRanges\} tableJson=\{test\.ref\} refNote=\{test\.ref_note\} \/>/, 'full page must reveal the complete reference table and its note')
assert.match(source, /catalog-detail-note/)
assert.match(source, /หมายเหตุ/)
assert.match(source, /<SpecimenSection test=\{test\} showNote=\{false\} \/>/)
assert.match(source, /<Icon name="doc"/)
assert.match(source, /<Icon name="phone"/)

console.log('catalog page layout test: all assertions passed')
