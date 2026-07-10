import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/(protected)/staff/personnel/PersonnelClient.tsx', 'utf8')
const statCardStart = source.indexOf('function StatCard')
const statCardEnd = source.indexOf('// ── Alert pill ──')

assert.notEqual(statCardStart, -1, 'StatCard component should exist')
assert.notEqual(statCardEnd, -1, 'StatCard component section should be bounded')

const statCardSource = source.slice(statCardStart, statCardEnd)

assert.equal(
  /border:\s*['"`]/.test(statCardSource),
  false,
  'StatCard must not mix border shorthand with dynamic border longhands',
)
assert.equal(
  /borderTop:\s*['"`]/.test(statCardSource),
  false,
  'StatCard must not use borderTop shorthand with dynamic border longhands',
)

