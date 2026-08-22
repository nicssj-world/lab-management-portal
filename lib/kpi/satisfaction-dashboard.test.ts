import assert from 'node:assert/strict'

async function run() {
  const domain = await import('./satisfaction-dashboard').catch(() => ({} as Record<string, unknown>))
  assert.equal(typeof domain.buildSatisfactionDashboard, 'function', 'exports the satisfaction dashboard builder')
  assert.equal(typeof domain.getSatisfactionStatus, 'function', 'exports pass/below/missing classification')
  assert.equal(typeof domain.getThaiFiscalYear, 'function', 'exports the Bangkok fiscal-year default')

  const buildSatisfactionDashboard = domain.buildSatisfactionDashboard as (input: unknown) => {
    fiscalYear: number
    years: number[]
    summary: { activeMetrics: number; pass: number; below: number; missing: number; pendingPublication: number }
    metrics: Array<{
      code: string
      status: 'pass' | 'below' | 'missing'
      current: null | {
        value: number | null
        source: 'survey' | 'manual'
        sourceNote: string | null
        campaignId: string | null
        campaignName: string | null
        departmentName: string | null
        surveyCode: string | null
        publishedByName: string | null
      }
      previousValue: number | null
      delta: number | null
      history: Array<{ fiscalYear: number; source: 'survey' | 'manual' }>
    }>
  }
  const getSatisfactionStatus = domain.getSatisfactionStatus as (value: number | null, target: number) => string
  const getThaiFiscalYear = domain.getThaiFiscalYear as (date: Date) => number

  assert.equal(getSatisfactionStatus(80, 80), 'pass', 'a value equal to target passes')
  assert.equal(getSatisfactionStatus(79.99, 80), 'below')
  assert.equal(getSatisfactionStatus(null, 80), 'missing')
  assert.equal(getThaiFiscalYear(new Date('2026-09-30T16:59:59.999Z')), 2569)
  assert.equal(getThaiFiscalYear(new Date('2026-09-30T17:00:00.000Z')), 2570)

  const input = {
    fiscalYear: 2569,
    metrics: [
      { code: 'outpatient', name: 'ผู้ป่วยนอก', target: 80, isActive: true },
      { code: 'donor', name: 'ผู้บริจาคโลหิต', target: 90, isActive: true },
      { code: 'ward', name: 'ผู้ป่วยใน', target: 85, isActive: true },
      { code: 'legacy', name: 'เลิกใช้งาน', target: 80, isActive: false },
    ],
    values: [
      { metricCode: 'outpatient', fiscalYear: 2569, value: 80, sourceNote: 'must not override survey source' },
      { metricCode: 'outpatient', fiscalYear: 2568, value: 75, sourceNote: 'external report' },
      { metricCode: 'outpatient', fiscalYear: 2567, value: 70, sourceNote: null },
      { metricCode: 'donor', fiscalYear: 2569, value: 89.99, sourceNote: 'manual source' },
      { metricCode: 'ward', fiscalYear: 2567, value: 84, sourceNote: null },
      { metricCode: 'ward', fiscalYear: 2563, value: null, sourceNote: null },
    ],
    publications: [
      {
        metricCode: 'outpatient',
        fiscalYear: 2569,
        campaignId: 'campaign-published',
        responseCount: 12,
        publishedAt: '2026-08-20T10:00:00.000Z',
        publishedByName: 'ผู้ดูแล KPI',
      },
    ],
    campaigns: [
      {
        id: 'campaign-published', metricCode: 'outpatient', fiscalYear: 2569, status: 'closed',
        name: 'รอบปีงบประมาณ 2569 (OPD)', departmentName: 'OPD', surveyCode: 'FM-01',
      },
      {
        id: 'campaign-pending', metricCode: 'ward', fiscalYear: 2569, status: 'closed',
        name: 'รอบปีงบประมาณ 2569 (ศสม.)', departmentName: 'ศสม.', surveyCode: 'FM-02',
      },
      {
        id: 'campaign-future', metricCode: 'donor', fiscalYear: 2570, status: 'draft',
        name: 'รอบปีงบประมาณ 2570', departmentName: 'OPD', surveyCode: 'FM-03',
      },
    ],
  }

  const dashboard = buildSatisfactionDashboard(input)
  assert.equal(dashboard.fiscalYear, 2569)
  assert.deepEqual(dashboard.years, [2570, 2569, 2568, 2567], 'years are unique and newest first')
  assert.deepEqual(dashboard.summary, {
    activeMetrics: 3,
    pass: 1,
    below: 1,
    missing: 1,
    pendingPublication: 1,
  })

  const outpatient = dashboard.metrics.find((metric) => metric.code === 'outpatient')!
  assert.equal(outpatient.status, 'pass')
  assert.equal(outpatient.current?.source, 'survey', 'a matching publication makes the value survey-origin')
  assert.equal(outpatient.current?.sourceNote, 'must not override survey source')
  assert.equal(outpatient.current?.campaignId, 'campaign-published')
  assert.equal(outpatient.current?.campaignName, 'รอบปีงบประมาณ 2569 (OPD)')
  assert.equal(outpatient.current?.departmentName, 'OPD')
  assert.equal(outpatient.current?.surveyCode, 'FM-01')
  assert.equal(outpatient.current?.publishedByName, 'ผู้ดูแล KPI')
  assert.equal(outpatient.previousValue, 75, 'previous value is the immediately preceding fiscal year')
  assert.equal(outpatient.delta, 5)
  assert.deepEqual(outpatient.history.map((row) => row.fiscalYear), [2569, 2568, 2567])
  assert.deepEqual(outpatient.history.map((row) => row.source), ['survey', 'manual', 'manual'])

  const ward = dashboard.metrics.find((metric) => metric.code === 'ward')!
  assert.equal(ward.status, 'missing')
  assert.equal(ward.current, null)
  assert.equal(ward.previousValue, null, 'does not skip over a missing prior year')
  assert.equal(ward.delta, null)
  assert.deepEqual(ward.history.map((row) => row.fiscalYear), [2567], 'legacy null placeholders are not KPI history')
  assert.ok(!dashboard.years.includes(2563), 'a null placeholder does not create an empty fiscal year')

  const passOnly = buildSatisfactionDashboard({ ...input, filters: { status: 'pass' } })
  assert.deepEqual(passOnly.metrics.map((metric) => metric.code), ['outpatient'])
  assert.deepEqual(passOnly.summary, { activeMetrics: 1, pass: 1, below: 0, missing: 0, pendingPublication: 1 })

  const surveyOnly = buildSatisfactionDashboard({ ...input, filters: { source: 'survey' } })
  assert.deepEqual(surveyOnly.metrics.map((metric) => metric.code), ['outpatient'])

  const manualOnly = buildSatisfactionDashboard({ ...input, filters: { source: 'manual' } })
  assert.deepEqual(manualOnly.metrics.map((metric) => metric.code), ['donor'])

  const missingOnly = buildSatisfactionDashboard({ ...input, filters: { status: 'missing' } })
  assert.deepEqual(missingOnly.metrics.map((metric) => metric.code), ['legacy', 'ward'])
  assert.deepEqual(missingOnly.summary, { activeMetrics: 1, pass: 0, below: 0, missing: 1, pendingPublication: 1 })

  const oneMetric = buildSatisfactionDashboard({ ...input, filters: { metricCode: 'donor' } })
  assert.deepEqual(oneMetric.metrics.map((metric) => metric.code), ['donor'])
  assert.equal(oneMetric.summary.pendingPublication, 0, 'pending count respects the metric filter')

  console.log('KPI satisfaction dashboard domain tests passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
