import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => {
  const full = join(process.cwd(), path)
  return existsSync(full) ? readFileSync(full, 'utf8') : ''
}

const publicRoute = read('app/api/satisfaction/[token]/route.ts')
const publicPage = read('app/s/[token]/page.tsx')
const publicForm = read('components/satisfaction/PublicSurveyForm.tsx')
const publicServer = read('lib/surveys/public-server.ts')
const manager = read('components/satisfaction/CampaignManager.tsx')
const adminRoute = read('app/api/admin/satisfaction/campaigns/route.ts')
const itemRoute = read('app/api/admin/satisfaction/campaigns/[campaignId]/route.ts')
const tokenRoute = read('app/api/admin/satisfaction/campaigns/[campaignId]/token/route.ts')

for (const source of [publicRoute, publicPage, itemRoute, tokenRoute]) {
  assert.match(source, /params\s*:\s*Promise</)
  assert.ok(source.includes('await params'))
}
assert.ok(publicRoute.includes('content-length'))
assert.ok(publicRoute.includes('64 * 1024'))
assert.ok(!publicRoute.includes('requireResource('), 'public API does not require staff auth')
assert.ok(publicRoute.includes('httpOnly: true'))
assert.ok(publicRoute.includes('secure: true'))
assert.ok(publicRoute.includes("sameSite: 'lax'"))
assert.ok(publicRoute.includes('submissionKey'))
assert.ok(publicRoute.includes('validateSubmission'))
assert.ok(publicServer.includes("rpc('submit_survey_response'"))
assert.ok(publicRoute.includes('deviceHash'))

for (const source of [adminRoute, itemRoute, tokenRoute]) {
  assert.ok(source.includes("requireResource('แบบสำรวจความพึงพอใจ', 'edit')"))
  assert.ok(source.includes('.safeParse('))
}
assert.ok(manager.includes('QRCode.toDataURL'))
assert.ok(manager.includes('download'))
assert.ok(manager.includes('/s/'))

assert.ok(publicPage.includes('<PublicSurveyForm'))
assert.ok(publicForm.includes('inputMode="numeric"') || read('components/satisfaction/SurveyRenderer.tsx').includes('inputMode="numeric"'))
assert.ok(publicForm.includes('role="alert"'))
assert.ok(publicForm.includes('aria-live="polite"'))
assert.ok(publicForm.includes('disabled={submitting'))
assert.ok(publicForm.includes('submissionKeyRef'))
for (const state of ['scheduled', 'closed', 'expired', 'limit_reached', 'duplicate']) {
  assert.ok(publicForm.includes(state), `renders ${state} state`)
}

console.log('satisfaction public flow tests passed')
