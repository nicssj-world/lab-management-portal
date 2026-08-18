import assert from 'node:assert/strict'
import { isKpiEntryComplete } from './entry-completeness'

assert.equal(
  isKpiEntryComplete(0, null, { denominator: null }),
  true,
  'count KPI with a zero numerator is a completed entry',
)
assert.equal(
  isKpiEntryComplete(0, 0, { denominator: 'จำนวนทั้งหมด' }),
  true,
  'percentage KPI with 0/0 is a completed zero result',
)
assert.equal(
  isKpiEntryComplete(1, 0, { denominator: 'จำนวนทั้งหมด' }),
  false,
  'percentage KPI with a non-zero numerator and zero denominator is invalid',
)
assert.equal(
  isKpiEntryComplete(1, 10, { denominator: 'จำนวนทั้งหมด' }),
  true,
  'percentage KPI with a positive denominator is complete',
)
assert.equal(
  isKpiEntryComplete(null, 10, { denominator: 'จำนวนทั้งหมด' }),
  false,
  'an entry without a numerator is incomplete',
)

console.log('KPI entry completeness tests passed')
