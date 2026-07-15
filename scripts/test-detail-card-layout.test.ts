import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('components/tests/TestDetailCard.tsx', 'utf8')

assert.match(source, /test-detail-info-grid[\s\S]*?grid-template-columns/, 'summary fields should use CSS Grid')
assert.match(source, /test-detail-info-box--metric/, 'volume and TAT should use the metric card variant')
assert.match(source, /test-detail-info-box--descriptive/, 'specimen and service time should use the descriptive card variant')
assert.match(source, /overflow-wrap:\s*anywhere/, 'long summary values should be able to wrap safely')
assert.match(source, /test-detail-info-box--metric[\s\S]*?text-align:\s*center/, 'metric values should be centered')
assert.match(source, /@media \(max-width:\s*1100px\)[\s\S]*?test-detail-info-box--wide[\s\S]*?grid-column:\s*1\s*\/\s*-1/, 'descriptive cards should span a row at intermediate widths')
assert.match(source, /@media \(max-width:\s*767px\)[\s\S]*?test-detail-info-grid[\s\S]*?grid-template-columns:\s*1fr/, 'phone layout should use one summary column')
assert.doesNotMatch(source, />TAT \{tatDisplay\}</, 'TAT should not be duplicated below price')
assert.match(source, /<strong>รหัส E-Phis:<\/strong>\{' '\}<strong>\{test\.code\}<\/strong>/, 'E-Phis label and code should be bold with an explicit space between them')

console.log('test detail card layout tests passed')
