import assert from 'node:assert/strict'
import {
  assertCampaignTransition,
  campaignAvailability,
  createPublicToken,
} from './campaign'
import type { SurveyCampaign } from './types'

const base: SurveyCampaign = {
  id: 'campaign-1',
  surveyId: 'survey-1',
  surveyVersionId: 'version-1',
  name: 'รอบปี 2569',
  publicToken: 'token',
  status: 'open',
  opensAt: null,
  closesAt: null,
  responseLimit: null,
  onePerDevice: false,
}
const now = new Date('2026-07-17T12:00:00.000Z')

assert.deepEqual(campaignAvailability(base, now, 0, false), { available: true, code: 'open' })
assert.equal(campaignAvailability({ ...base, status: 'draft' }, now, 0, false).code, 'draft')
assert.equal(campaignAvailability({ ...base, status: 'closed' }, now, 0, false).code, 'closed')
assert.equal(campaignAvailability({ ...base, opensAt: '2026-07-18T00:00:00.000Z' }, now, 0, false).code, 'scheduled')
assert.equal(campaignAvailability({ ...base, closesAt: '2026-07-17T11:00:00.000Z' }, now, 0, false).code, 'expired')
assert.equal(campaignAvailability({ ...base, responseLimit: 10 }, now, 10, false).code, 'limit_reached')
assert.equal(campaignAvailability({ ...base, onePerDevice: true }, now, 1, true).code, 'duplicate')

const token = createPublicToken()
assert.match(token, /^[A-Za-z0-9_-]{43}$/)
assert.notEqual(createPublicToken(), token)

assert.doesNotThrow(() => assertCampaignTransition('draft', 'open'))
assert.doesNotThrow(() => assertCampaignTransition('open', 'closed'))
assert.throws(() => assertCampaignTransition('closed', 'open'), /ปิดแล้ว/)

console.log('campaign tests passed')
