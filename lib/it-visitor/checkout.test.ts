import assert from 'node:assert/strict'
import {
  createCheckoutSecret,
  hashCheckoutSecret,
  safeSecretEqual,
} from './checkout'

const first = createCheckoutSecret()
const second = createCheckoutSecret()

assert.match(first, /^[A-Za-z0-9_-]+$/)
assert.ok(Buffer.from(first, 'base64url').byteLength >= 32)
assert.notEqual(first, second)

const firstHash = hashCheckoutSecret(first)
assert.match(firstHash, /^[a-f0-9]{64}$/)
assert.equal(firstHash, hashCheckoutSecret(first))
assert.notEqual(firstHash, hashCheckoutSecret(second))

assert.equal(safeSecretEqual(first, first), true)
assert.equal(safeSecretEqual(first, second), false)
assert.equal(safeSecretEqual(first, 'invalid-secret'), false)

console.log('visitor checkout credential tests passed')
