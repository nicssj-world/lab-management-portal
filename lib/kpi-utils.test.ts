import assert from 'node:assert/strict'
import { calcResult, isNoIncidentRate, isPass } from './kpi-utils'

assert.equal(
  calcResult(0, 0),
  null,
  'a zero numerator over a zero denominator has no measurable percentage',
)
assert.equal(
  calcResult(1, 0),
  null,
  'a non-zero numerator over a zero denominator must remain invalid',
)
assert.equal(isNoIncidentRate(0, 0), true, '0/0 should be identified as no incidents')
assert.equal(isNoIncidentRate(1, 0), false, 'a non-zero numerator is not a no-incident rate')

assert.equal(
  isPass(100, 'eq', 100, 13),
  true,
  'percentage equality should compare the calculated result with the target',
)
assert.equal(
  isPass(99.99, 'eq', 100, 13),
  false,
  'percentage equality should fail when the calculated result misses the target',
)
assert.equal(
  isPass(null, 'eq', 0, 0, true),
  true,
  'count equality should compare the numerator with the target',
)
assert.equal(
  isPass(null, 'eq', 1, 0, true),
  false,
  'count equality should fail when the numerator misses the target',
)
assert.equal(
  isPass(null, 'eq', 100, 13),
  null,
  'percentage equality without a calculated result should remain pending',
)
assert.equal(
  isPass(null, 'gte', 100, 120, true),
  true,
  'count metrics with a minimum target should compare the numerator',
)
assert.equal(
  isPass(null, 'lte', 5, 6, true),
  false,
  'count metrics with a maximum target should compare the numerator',
)
assert.equal(
  isPass(null, 'lte', 5, 0, true),
  true,
  'count metrics with a maximum target should pass zero values',
)

console.log('KPI utility tests passed')
