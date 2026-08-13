import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

let scanText
try {
  ;({ scanText } = await import('./secret-scan-core.mjs'))
} catch {
  assert.fail('secret scanner implementation must exist')
}

function fakeJwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.${'x'.repeat(43)}`
}

const legacyServiceRole = fakeJwt({ iss: 'supabase', role: 'service_role', exp: 4102444800 })
const ordinaryUserJwt = fakeJwt({ iss: 'supabase', role: 'authenticated', sub: 'fixture-user' })

assert.deepEqual(
  scanText(`SUPABASE_SERVICE_ROLE_KEY=${legacyServiceRole}`, 'fixture.env').map(({ kind }) => kind),
  ['Supabase legacy service_role JWT'],
  'legacy service_role JWT must be rejected',
)

assert.deepEqual(
  scanText(`SUPABASE_SECRET_KEY=${'sb_' + 'secret_' + 'fixture0123456789abcdefghijklmnop'}`, 'fixture.env').map(({ kind }) => kind),
  ['Supabase secret API key'],
  'modern Supabase secret keys must be rejected',
)

for (const safeFixture of [
  'NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_fixture0123456789',
  'SUPABASE_SERVICE_ROLE_KEY=your-service-role-key',
  `Authorization: Bearer ${ordinaryUserJwt}`,
  'Documentation may mention the service_role database role without containing a credential.',
]) {
  assert.deepEqual(scanText(safeFixture, 'safe.txt'), [], `safe fixture was rejected: ${safeFixture}`)
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
assert.equal(packageJson.scripts?.['test:secrets'], 'node scripts/secret-scan.test.mjs')
assert.equal(packageJson.scripts?.['security:secrets'], 'node scripts/secret-scan.mjs')
assert.equal(packageJson.scripts?.prepare, 'node scripts/install-git-hooks.mjs')

const hook = readFileSync('.githooks/pre-commit', 'utf8')
assert.match(hook, /secret-scan\.mjs --staged/)

const workflow = readFileSync('.github/workflows/secret-scan.yml', 'utf8')
assert.match(workflow, /actions\/checkout@1af3b93b6815bc44a9784bd300feb67ff0d1eeb3 # v6\.0\.0/)
assert.match(workflow, /npm run test:secrets/)
assert.match(workflow, /npm run security:secrets/)

console.log('secret-scan: all assertions passed')
