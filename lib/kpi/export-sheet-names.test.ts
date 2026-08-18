import assert from 'node:assert/strict'
import { getUniqueWorksheetName } from './export-sheet-names'

const used = new Set(['รวม'])
const first = getUniqueWorksheetName('department/with:a*long-name-that-is-over-31-characters', used)
used.add(first)
const second = getUniqueWorksheetName('department/with:a*long-name-that-is-over-31-characters', used)

assert.ok(first.length <= 31)
assert.ok(second.length <= 31)
assert.notEqual(first.toLowerCase(), second.toLowerCase(), 'Excel worksheet names are case-insensitive')
assert.equal(getUniqueWorksheetName('รวม', used), 'รวม_2')

console.log('KPI export worksheet name tests passed')
