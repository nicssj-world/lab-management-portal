import { strict as assert } from 'node:assert'
import { NAME_PREFIX_OPTIONS, formatProfileName } from './name'

assert.deepEqual(NAME_PREFIX_OPTIONS, ['นาย', 'น.ส.', 'นาง'])
assert.equal(formatProfileName('สมหญิง ใจดี', 'นาง'), 'นางสมหญิง ใจดี')
assert.equal(formatProfileName(' สมหญิง ใจดี ', ' นาย '), 'นายสมหญิง ใจดี')
assert.equal(formatProfileName('สมหญิง ใจดี', null), 'สมหญิง ใจดี')
assert.equal(formatProfileName('  ', 'นาง'), 'นาง')
assert.equal(formatProfileName(null, null), '')

console.log('lib/personnel/name.test.ts: all assertions passed')
