import assert from 'node:assert/strict'
import { getKpiNumeratorLabel, getKpiTargetLabel } from './annual-labels'

assert.equal(getKpiNumeratorLabel('TAT'), 'ทันเวลา')
assert.equal(getKpiNumeratorLabel('ERROR'), 'คลาดเคลื่อน')
assert.equal(getKpiNumeratorLabel('RISK'), 'จำนวน')
assert.equal(getKpiTargetLabel({ target_type: 'eq', target_val: 100, unit: '%' }), '= 100%')
assert.equal(getKpiTargetLabel({ target_type: 'gte', target_val: 100, unit: '%' }), '≥ 100%')
assert.equal(getKpiTargetLabel({ target_type: 'lte', target_val: 25, unit: '%' }), '≤ 25%')
assert.equal(getKpiTargetLabel({ target_type: 'gte', target_val: 5, denominator: null }), '≥ 5')
console.log('KPI annual label tests passed')
