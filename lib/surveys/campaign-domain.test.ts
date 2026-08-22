import assert from 'node:assert/strict'
import * as campaignDomain from './campaign'
import { createCampaignSchema, updateCampaignSchema } from './schemas'
import type { SurveyCampaign } from './types'

assert.equal(campaignDomain.SURVEY_TIME_ZONE, 'Asia/Bangkok')
for (const helper of ['thaiFiscalYearPeriod', 'campaignDisplayName', 'campaignEffectiveStatus', 'assertCampaignUpdatePolicy'] as const) {
  assert.equal(typeof campaignDomain[helper], 'function', `exports ${helper}`)
}
const {
  assertCampaignUpdatePolicy,
  campaignDisplayName,
  campaignEffectiveStatus,
  thaiFiscalYearPeriod,
} = campaignDomain

const period = thaiFiscalYearPeriod(2569)
assert.deepEqual(period, {
  fiscalYear: 2569,
  opensAt: '2025-09-30T17:00:00.000Z',
  closesAt: '2026-09-30T17:00:00.000Z',
  periodStart: '2025-10-01',
  periodEnd: '2026-09-30',
})
assert.throws(() => thaiFiscalYearPeriod(2499), /ปีงบประมาณ/)
assert.equal(campaignDisplayName(2569, ' OPD '), 'รอบปีงบประมาณ 2569 (OPD)')

const base: SurveyCampaign = {
  id: 'campaign-1',
  surveyId: 'survey-1',
  surveyVersionId: 'version-1',
  name: 'รอบปีงบประมาณ 2569 (OPD)',
  publicToken: 'token',
  status: 'open',
  fiscalYear: 2569,
  departmentId: 20,
  targetResponseCount: null,
  kpiMetricCode: 'outpatient',
  opensAt: period.opensAt,
  closesAt: period.closesAt,
  responseLimit: null,
  onePerDevice: false,
}

assert.equal(campaignEffectiveStatus({ ...base, status: 'draft' }, new Date('2026-01-01T00:00:00Z')), 'draft')
assert.equal(campaignEffectiveStatus(base, new Date('2025-09-30T16:59:59.999Z')), 'scheduled')
assert.equal(campaignEffectiveStatus(base, new Date('2025-09-30T17:00:00.000Z')), 'open')
assert.equal(campaignEffectiveStatus(base, new Date('2026-09-30T17:00:00.000Z')), 'expired_pending_close')
assert.equal(campaignEffectiveStatus({ ...base, status: 'closed' }, new Date('2027-01-01T00:00:00Z')), 'closed')

const createPayload = {
  surveyId: 'd18c7664-c2a4-43f8-8252-12aa1dd6b41d',
  surveyVersionId: '0306689c-0646-44e8-a7d0-c9fc89935910',
  fiscalYear: 2569,
  departmentId: 20,
  targetResponseCount: 120,
  kpiMetricCode: 'outpatient',
  responseLimit: null,
  onePerDevice: false,
}
assert.equal(createCampaignSchema.safeParse(createPayload).success, true)
assert.equal(createCampaignSchema.safeParse({ ...createPayload, targetResponseCount: 0 }).success, false)
assert.equal(createCampaignSchema.safeParse({ ...createPayload, kpiMetricCode: '' }).success, false)
assert.equal(createCampaignSchema.safeParse({ ...createPayload, name: 'พิมพ์เอง' }).success, false)
assert.equal(createCampaignSchema.safeParse({ ...createPayload, opensAt: period.opensAt }).success, false)

assert.equal(updateCampaignSchema.safeParse({ targetResponseCount: null }).success, true)
assert.equal(updateCampaignSchema.safeParse({ fiscalYear: 2570, departmentId: 19, kpiMetricCode: 'outpatient_mcl' }).success, true)
assert.equal(updateCampaignSchema.safeParse({ name: 'แก้เอง' }).success, false)
assert.equal(updateCampaignSchema.safeParse({ closesAt: period.closesAt }).success, false)

assert.doesNotThrow(() => assertCampaignUpdatePolicy(base, { targetResponseCount: 150 }, new Date('2026-08-23T00:00:00Z')))
assert.throws(() => assertCampaignUpdatePolicy(base, { departmentId: 19 }, new Date('2026-08-23T00:00:00Z')), /เปิดรับคำตอบแล้ว/)
assert.throws(() => assertCampaignUpdatePolicy(base, { responseLimit: 200 }, new Date('2026-08-23T00:00:00Z')), /เปิดรับคำตอบแล้ว/)
assert.throws(() => assertCampaignUpdatePolicy(base, { kpiMetricCode: 'donor' }, new Date('2026-08-23T00:00:00Z')), /KPI/)
assert.doesNotThrow(() => assertCampaignUpdatePolicy({ ...base, kpiMetricCode: null }, { kpiMetricCode: 'outpatient' }, new Date('2026-08-23T00:00:00Z')))
assert.throws(() => assertCampaignUpdatePolicy({ ...base, kpiMetricCode: null }, { status: 'closed' }, new Date('2026-08-23T00:00:00Z')), /กำหนด KPI/)
assert.throws(() => assertCampaignUpdatePolicy({ ...base, status: 'closed' }, { targetResponseCount: 200 }, new Date('2026-10-01T00:00:00Z')), /ปิดแล้ว/)

console.log('campaign domain tests passed')
