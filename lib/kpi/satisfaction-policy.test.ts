import assert from 'node:assert/strict'
import * as validation from './satisfaction-validation'

async function run() {
  const policy = await import('./satisfaction-policy').catch(() => ({} as Record<string, unknown>))
  assert.equal(typeof policy.getManualValueConflict, 'function', 'exports the manual-value reservation guard')
  assert.equal(typeof policy.canDeactivateSatisfactionMetric, 'function', 'exports the metric deactivation guard')
  assert.equal(typeof validation.validateSatisfactionMetricCreate, 'function', 'exports metric create validation')
  assert.equal(typeof validation.validateSatisfactionMetricPatch, 'function', 'exports metric patch validation')
  assert.equal(typeof validation.validateManualSatisfactionValue, 'function', 'exports manual-value validation')
  assert.equal(typeof validation.validateSatisfactionDashboardQuery, 'function', 'exports dashboard query validation')

  const getManualValueConflict = policy.getManualValueConflict as (input: {
    campaignReserved: boolean
    surveyPublicationExists: boolean
  }) => string | null
  const canDeactivate = policy.canDeactivateSatisfactionMetric as (statuses: string[]) => boolean

  assert.equal(getManualValueConflict({ campaignReserved: false, surveyPublicationExists: false }), null)
  assert.equal(getManualValueConflict({ campaignReserved: true, surveyPublicationExists: false }), 'campaign_reserved')
  assert.equal(getManualValueConflict({ campaignReserved: false, surveyPublicationExists: true }), 'survey_published')
  assert.equal(canDeactivate([]), true)
  assert.equal(canDeactivate(['closed']), true)
  assert.equal(canDeactivate(['draft']), false)
  assert.equal(canDeactivate(['closed', 'open']), false)

  const create = (validation as Record<string, Function>).validateSatisfactionMetricCreate({
    name: '  ผู้ป่วยนอก  ',
    target: 80,
  })
  assert.equal(create.ok, true)
  assert.deepEqual(create.data, { name: 'ผู้ป่วยนอก', target: 80 })
  assert.equal((validation as Record<string, Function>).validateSatisfactionMetricCreate({ name: '', target: 80 }).ok, false)
  assert.equal((validation as Record<string, Function>).validateSatisfactionMetricCreate({ name: 'A', target: 101 }).ok, false)
  assert.equal((validation as Record<string, Function>).validateSatisfactionMetricCreate({ code: 'mutable', name: 'A', target: 80 }).ok, false)

  const patch = (validation as Record<string, Function>).validateSatisfactionMetricPatch({
    code: 'outpatient', name: ' ชื่อใหม่ ', target: 82, isActive: false,
  })
  assert.equal(patch.ok, true)
  assert.deepEqual(patch.data, { code: 'outpatient', name: 'ชื่อใหม่', target: 82, isActive: false })
  assert.equal((validation as Record<string, Function>).validateSatisfactionMetricPatch({ code: 'outpatient' }).ok, false)
  assert.equal((validation as Record<string, Function>).validateSatisfactionMetricPatch({ code: 'outpatient', newCode: 'changed' }).ok, false)

  const manual = (validation as Record<string, Function>).validateManualSatisfactionValue({
    metricCode: 'outpatient', fiscalYear: 2569, value: 0, sourceNote: ' รายงานภายนอก ',
  })
  assert.equal(manual.ok, true)
  assert.deepEqual(manual.data, {
    metricCode: 'outpatient', fiscalYear: 2569, value: 0, sourceNote: 'รายงานภายนอก',
  })
  assert.equal((validation as Record<string, Function>).validateManualSatisfactionValue({
    metricCode: 'outpatient', fiscalYear: 2569, value: 80, sourceNote: '   ',
  }).ok, false)

  const query = (validation as Record<string, Function>).validateSatisfactionDashboardQuery({
    fiscalYear: '2569', metricCode: 'outpatient', source: 'survey', status: 'pass',
  })
  assert.equal(query.ok, true)
  assert.deepEqual(query.data, {
    fiscalYear: 2569, metricCode: 'outpatient', source: 'survey', status: 'pass',
  })
  assert.equal((validation as Record<string, Function>).validateSatisfactionDashboardQuery({ fiscalYear: 'bad' }).ok, false)
  assert.equal((validation as Record<string, Function>).validateSatisfactionDashboardQuery({ source: 'unknown' }).ok, false)

  console.log('KPI satisfaction policy and validation tests passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
