import assert from 'node:assert/strict'
import {
  contractsCutoverTarget,
  isContractsCutoverActive,
  contractsGoneResponse,
  legacyContractRedirect,
} from '../lib/contracts-cutover'

// The gate is driven purely by LABCBH_STOCK_URL, so a portal that has not been
// pointed at the stock system keeps behaving exactly as it does today.
assert.equal(isContractsCutoverActive({}), false)
assert.equal(isContractsCutoverActive({ LABCBH_STOCK_URL: '' }), false)
assert.equal(isContractsCutoverActive({ LABCBH_STOCK_URL: '   ' }), false)
assert.equal(isContractsCutoverActive({ LABCBH_STOCK_URL: 'https://stock.example' }), true)

// Trailing slashes are trimmed so callers can join paths without doubling up.
assert.equal(contractsCutoverTarget({ LABCBH_STOCK_URL: 'https://stock.example/' }), 'https://stock.example')
assert.equal(contractsCutoverTarget({ LABCBH_STOCK_URL: ' https://stock.example ' }), 'https://stock.example')
assert.equal(contractsCutoverTarget({}), null)

// Only absolute http(s) origins are accepted. A relative or javascript: value
// would turn the redirect into an open-redirect or XSS vector.
assert.equal(contractsCutoverTarget({ LABCBH_STOCK_URL: '/staff/contracts' }), null)
assert.equal(contractsCutoverTarget({ LABCBH_STOCK_URL: 'javascript:alert(1)' }), null)
assert.equal(contractsCutoverTarget({ LABCBH_STOCK_URL: 'ftp://stock.example' }), null)

// Deep links keep the contract list path on the destination.
assert.equal(
  legacyContractRedirect({ LABCBH_STOCK_URL: 'https://stock.example' }),
  'https://stock.example/contracts',
)
assert.equal(legacyContractRedirect({}), null)

async function main() {
  // Writes must be refused with 410 Gone, not 404 or a silent success, so that a
  // stale browser tab or an integration cannot mutate contract data post-cutover.
  const gone = contractsGoneResponse('https://stock.example')
  assert.equal(gone.status, 410)
  const body = await gone.json()
  assert.equal(body.movedTo, 'https://stock.example/contracts')
  assert.match(body.error, /LABCBH Stock/)

  // The response must still be well-formed when the target is unknown.
  const goneNoTarget = contractsGoneResponse(null)
  assert.equal(goneNoTarget.status, 410)
  assert.equal((await goneNoTarget.json()).movedTo, null)

  console.log('contracts cutover tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
