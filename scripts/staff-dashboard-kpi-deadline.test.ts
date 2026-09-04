import assert from 'node:assert/strict'
import fs from 'node:fs'

const dashboard = fs.readFileSync('app/(protected)/staff/dashboard/page.tsx', 'utf8')
const deadlineLine = dashboard
  .split(/\r?\n/)
  .find((line) => line.includes('const kpiDeadlineLabel'))

assert.ok(deadlineLine, 'staff dashboard must format the KPI deadline label')
assert.match(
  deadlineLine,
  /timeZone:\s*['"]Asia\/Bangkok['"]/,
  'KPI deadline labels must be formatted in Bangkok time so the 15th is not rendered as the 14th on UTC servers',
)

console.log('Staff dashboard KPI deadline tests passed')
