import assert from 'node:assert/strict'
import {
  getVisitorAutoCheckoutCutoff,
  isVisitorAutoCheckoutDue,
} from './auto-checkout'

const enteredAt = '2026-09-04T16:55:00.000Z' // 23:55 Asia/Bangkok
const cutoff = '2026-09-04T17:00:00.000Z' // 00:00 on 2026-09-05 Asia/Bangkok

assert.equal(getVisitorAutoCheckoutCutoff(enteredAt), cutoff)
assert.equal(isVisitorAutoCheckoutDue(enteredAt, '2026-09-04T16:59:59.999Z'), false)
assert.equal(isVisitorAutoCheckoutDue(enteredAt, cutoff), true)
assert.equal(getVisitorAutoCheckoutCutoff('not-a-date'), null)
assert.equal(isVisitorAutoCheckoutDue('not-a-date', cutoff), false)

console.log('visitor auto-checkout time tests passed')
