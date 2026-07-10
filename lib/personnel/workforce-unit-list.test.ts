import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/(protected)/staff/personnel/workforce/page.tsx', 'utf8')
const unitCard = source.match(/<BarListCard icon="building"[\s\S]+?\/>/)?.[0] ?? ''

assert.notEqual(unitCard, '', 'Workforce unit card should exist')
assert.equal(
  unitCard.includes('unitChartRows.slice'),
  false,
  'Workforce unit card should show every unit instead of truncating the list',
)
