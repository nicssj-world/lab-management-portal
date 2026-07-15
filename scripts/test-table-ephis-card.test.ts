import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('components/tests/TestTable.tsx', 'utf8')

assert.match(source, /className="test-table-mobile-ephis"[\s\S]*?<strong>รหัส E-Phis:<\/strong>\{' '\}<strong>\{t\.code\}<\/strong>/, 'mobile test cards should render the E-Phis label and code in one explicitly spaced line')

console.log('test table E-Phis card tests passed')
