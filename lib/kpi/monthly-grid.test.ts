import assert from 'node:assert/strict'

import { getMonthlyChartTableLayout, getMonthlyXAxisCenterPadding } from './monthly-grid'

const layout = getMonthlyChartTableLayout(12)

assert.equal(layout.labelColumnWidth, 56)
assert.equal(layout.chartRightGutter, 16)
assert.equal(layout.tableWidth, 'calc(100% - 16px)')
assert.equal(layout.minimumContentWidth, 840)
assert.equal(layout.columns.length, 13)
assert.deepEqual(layout.columns, ['56px', ...Array(12).fill('auto')])
assert.equal(getMonthlyXAxisCenterPadding(2032, layout), 245 / 3)
assert.equal(getMonthlyXAxisCenterPadding(0, layout), 0)

assert.throws(() => getMonthlyChartTableLayout(0), /at least one month/i)

console.log('monthly-grid tests passed')
