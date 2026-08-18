import assert from 'node:assert/strict'
import { getChartYMin, hasKpiSeriesData, summarizeCountSeries } from './presentation-rules'

assert.equal(hasKpiSeriesData([{ num: null, den: null, pct: null }]), false)
assert.equal(hasKpiSeriesData([{ num: 0, den: null, pct: null }]), true, 'a recorded zero is still data')

assert.deepEqual(
  summarizeCountSeries([{ num: 0 }, { num: null }]),
  { total: 0, monthsWithData: 1 },
)

assert.equal(getChartYMin(25, [0, 10]), 0, 'a low target/value must not be clipped by the default 80% axis')
assert.equal(getChartYMin(95, [90, 100]), 80, 'high percentage KPIs should keep the readable default lower bound')

console.log('KPI presentation rule tests passed')
