import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync('components/kpi/KpiPresentationDashboard.tsx', 'utf8')

assert.match(dashboard, /getMonthlyXAxisCenterPadding/, 'monthly charts must calculate dynamic axis padding from their rendered width')
assert.equal((dashboard.match(/padding=\{\{ left: xAxisPadding, right: xAxisPadding \}\}/g) ?? []).length, 2, 'line and bar monthly charts must centre their points in the table month columns')

console.log('kpi month-axis alignment tests passed')
