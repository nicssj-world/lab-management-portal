import assert from 'node:assert/strict'
import { consumeRateLimit } from '../lib/security/rate-limit'

const key = `test-${crypto.randomUUID()}`
const first = consumeRateLimit({ key, limit: 2, windowMs: 60_000, now: 1_000 })
const second = consumeRateLimit({ key, limit: 2, windowMs: 60_000, now: 2_000 })
const blocked = consumeRateLimit({ key, limit: 2, windowMs: 60_000, now: 3_000 })
const reset = consumeRateLimit({ key, limit: 2, windowMs: 60_000, now: 61_000 })

assert.equal(first.allowed, true)
assert.equal(first.remaining, 1)
assert.equal(second.allowed, true)
assert.equal(second.remaining, 0)
assert.equal(blocked.allowed, false)
assert.equal(blocked.retryAfterSeconds, 58)
assert.equal(reset.allowed, true)
assert.equal(reset.remaining, 1)

console.log('rate limit tests passed')

