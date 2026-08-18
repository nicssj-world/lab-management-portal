import assert from 'node:assert/strict'
import { isKpiApplicable } from './presentation-scope'

const defs = [{ id: 4, code: 'TAT_UNCROSS' }, { id: 7, code: 'RISK_ID_OPD' }]
const depts = [{ id: 20, code: 'OPD' }, { id: 17, code: 'BLB' }]
const exclusions = new Set(['20|4'])

assert.equal(isKpiApplicable('TAT_UNCROSS', 'OPD', defs, depts, exclusions), false)
assert.equal(isKpiApplicable('TAT_UNCROSS', null, defs, depts, exclusions), true)
assert.equal(isKpiApplicable('RISK_ID_OPD', 'OPD', defs, depts, exclusions), true)
console.log('KPI presentation scope tests passed')
