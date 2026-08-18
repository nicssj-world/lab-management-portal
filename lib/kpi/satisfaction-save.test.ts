import assert from 'node:assert/strict'
import { buildMetricCode, getMissingSatisfactionMetrics } from './satisfaction-save'

const metrics = [
  { code: 'donor', name: 'ผู้บริจาค' },
  { code: 'outpatient', name: 'ผู้ป่วยนอก' },
]

const missing = getMissingSatisfactionMetrics(
  metrics,
  2569,
  [{ metric_code: 'donor', fiscal_year: 2569, value: 93.1 }],
)
assert.deepEqual(missing, [metrics[1]], 'adding an existing year must skip metrics that already have a row')

const code = buildMetricCode('ความพึงพอใจผู้รับบริการ', new Set())
assert.match(code, /^metric_[a-z0-9]+$/)
assert.notEqual(buildMetricCode('ความพึงพอใจผู้รับบริการ', new Set([code])), code)

console.log('KPI satisfaction save tests passed')
