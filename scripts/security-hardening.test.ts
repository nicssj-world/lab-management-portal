import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const profile = read('lib/auth/profile.ts')
const migration = read('scripts/security-hardening.sql')
const baseMigration = read('scripts/migration.sql')
const fixRls = read('scripts/fix-rls.sql')
const personnelSql = read('scripts/personnel-health-confidentiality.sql')
const externalQualitySql = read('scripts/external-quality-module.sql')
const extractRoute = read('app/api/admin/documents/extract/route.ts')
const documentRoute = read('app/api/documents/download/route.ts')
const nextConfig = read('next.config.ts')
const settingsRoute = read('app/api/settings/route.ts')
const testsRoute = read('app/api/tests/route.ts')
const loginPage = read('app/login/page.tsx')

assert.ok(profile.includes('ProfileNotProvisionedError'))
assert.ok(!profile.includes("role: 'Assistant'"), 'missing profiles must not be auto-provisioned')
assert.ok(!profile.includes(".from('profiles')\n      .insert"), 'profile helper must not insert accounts')
assert.ok(loginPage.includes('account_not_provisioned'))
assert.ok(loginPage.includes("signOut({ scope: 'local' })"))

assert.match(migration, /drop policy if exists "profiles_self_update"/i)
assert.match(migration, /revoke insert, update, delete on table public\.profiles from anon, authenticated/i)
assert.match(migration, /staff_health_records/)
assert.match(migration, /staff_confidentiality_agreements/)
assert.match(migration, /eqa_round_results/)
assert.match(migration, /revoke select on table public\.%I from anon, authenticated/i)
assert.ok(!baseMigration.includes('create policy "profiles_self_update"'))
assert.ok(!fixRls.includes('create policy "profiles_self_update"'))
assert.ok(!personnelSql.includes('FOR SELECT TO authenticated USING (true)'))
assert.ok(!externalQualitySql.includes("for select to authenticated using (true)"))

assert.ok(extractRoute.includes("canAccessDocuments(actor, 'edit')"))
assert.ok(extractRoute.includes("fileKey.startsWith('documents/')"))
assert.ok(extractRoute.includes('document-extract:'))
assert.ok(documentRoute.includes('document-proxy:'))
assert.ok(documentRoute.includes('public-document-download-ip'))
assert.ok(documentRoute.includes('Too many document requests'))

for (const header of ['Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) {
  assert.ok(nextConfig.includes(header), `missing ${header}`)
}
assert.ok(settingsRoute.includes('s-maxage=60'))
assert.ok(testsRoute.includes('s-maxage=60'))
assert.ok(settingsRoute.includes('consumeClientRateLimit'))
assert.ok(testsRoute.includes('consumeClientRateLimit'))

console.log('security hardening static tests passed')
