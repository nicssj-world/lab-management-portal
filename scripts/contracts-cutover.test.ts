import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

// Embedded credentials are refused rather than forwarded to the browser.
assert.equal(contractsCutoverTarget({ LABCBH_STOCK_URL: 'https://user:pass@stock.example' }), null)

// A query or fragment must be normalised away, not concatenated. Trimming the
// raw string would yield "https://stock.example?a=1/contracts", which points
// somewhere entirely different from the intended destination.
assert.equal(
  legacyContractRedirect({ LABCBH_STOCK_URL: 'https://stock.example?a=1' }),
  'https://stock.example/contracts',
)
assert.equal(
  legacyContractRedirect({ LABCBH_STOCK_URL: 'https://stock.example#frag' }),
  'https://stock.example/contracts',
)
// A base path on the destination is preserved.
assert.equal(
  legacyContractRedirect({ LABCBH_STOCK_URL: 'https://example.test/stock/' }),
  'https://example.test/stock/contracts',
)

// Deep links keep the contract list path on the destination.
assert.equal(
  legacyContractRedirect({ LABCBH_STOCK_URL: 'https://stock.example' }),
  'https://stock.example/contracts',
)
assert.equal(legacyContractRedirect({}), null)

// The portal dashboard reads contracts through the service role, so it keeps
// rendering after the migration regardless of RLS. That is the hazard: the
// remaining-budget gauge is computed from contract_usage, but post-cutover
// consumption is recorded in LABCBH Stock's contract_item_allocations instead.
// Left alone the widget freezes and permanently overstates remaining budget,
// which is worse than showing nothing. Both surfaces must retire with the module.
const attentionQueue = readFileSync(join(process.cwd(), 'components/dashboard/AttentionQueue.tsx'), 'utf8')
assert.match(
  attentionQueue,
  /contractsRetired/,
  'AttentionQueue must accept a contractsRetired flag',
)
assert.match(
  attentionQueue,
  /const canSeeContracts = !contractsRetired/,
  'the contracts group must be suppressed when the module is retired',
)

const dashboardPage = readFileSync(join(process.cwd(), 'app/(protected)/staff/dashboard/page.tsx'), 'utf8')
assert.match(
  dashboardPage,
  /isContractsCutoverActive/,
  'the dashboard must consult the cutover gate',
)
assert.match(
  dashboardPage,
  /contractsRetired=\{/,
  'the dashboard must pass the retired flag into AttentionQueue',
)
assert.match(
  dashboardPage,
  /!contractsRetired && \(permissions\['สัญญา'\]/,
  'the "add contract" quick action must retire too, or it lands users on a list with no create form',
)

// The redirect lives in the proxy as well as the page. In the proxy it runs
// before the auth check, so a bookmarked link reaches the new system instead of
// a login form for a module this portal no longer owns - and it is observable
// without a session, which the page-level redirect is not. API routes are
// deliberately excluded: they must answer 410 with a body, not a redirect.
const proxySource = readFileSync(join(process.cwd(), 'proxy.ts'), 'utf8')
// Assert against code, not prose: the comments here legitimately mention the
// API paths that the code must not touch.
const proxy = proxySource.replace(/^\s*\/\/.*$/gm, '')
assert.match(proxy, /legacyContractRedirect/, 'proxy must consult the cutover gate')
assert.match(proxy, /\/staff\/contracts/, 'proxy must match the retired page path')
assert.ok(
  !/\/api\/admin\/contracts/.test(proxy),
  'proxy must not redirect the API routes; they answer 410',
)
// A permanent redirect would be cached by browsers and survive a rollback.
assert.ok(
  !/redirect\([^)]*,\s*308\)/.test(proxy),
  'use a temporary redirect so the cutover stays reversible',
)

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
