import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/(protected)/staff/personnel/workforce/page.tsx', 'utf8')
const positionAggregation = source.match(/addCount\(positionCounts,[^\n]+\)/)?.[0] ?? ''

assert.notEqual(positionAggregation, '', 'Workforce position aggregation should exist')
assert.equal(
  positionAggregation.includes('p.role'),
  false,
  'Workforce position chart must not fall back to role when position_title is empty',
)
