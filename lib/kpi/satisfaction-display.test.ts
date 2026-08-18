import assert from 'node:assert/strict'
import { getLatestSatisfactionTarget } from './satisfaction-display'

const rows = [
  { metric_code: 'outpatient', fiscal_year: 2568, target_val: 80 },
  { metric_code: 'outpatient', fiscal_year: 2569, target_val: 92 },
  { metric_code: 'donor', fiscal_year: 2569, target_val: null },
]

assert.equal(getLatestSatisfactionTarget(rows, 'outpatient', 80), 92)
assert.equal(getLatestSatisfactionTarget(rows, 'donor', 80), 80)
assert.equal(getLatestSatisfactionTarget(rows, 'missing', 80), 80)

console.log('KPI satisfaction display tests passed')
