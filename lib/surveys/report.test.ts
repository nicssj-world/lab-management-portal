import assert from 'node:assert/strict'
import { buildAnnualReportModel } from './report'

const dashboard = {
  responseCount: 20,
  overall: { normalizedPct: 86.5, positivePct: 82, averageScore: 4.33, validAnswerCount: 180, distribution: { 1: 2, 2: 4, 3: 18, 4: 72, 5: 84 } },
  sections: [{ sectionId: 'service', title: 'บริการ', normalizedPct: 86.5, positivePct: 82, averageScore: 4.33, validAnswerCount: 180, distribution: { 1: 2, 2: 4, 3: 18, 4: 72, 5: 84 } }],
  questions: [], trend: [], demographics: {},
}

const report = buildAnnualReportModel({
  survey: { code: 'FM-QP-LAB-09-01', title: 'แบบสำรวจบริการด่านหน้า' },
  versionNumber: 2,
  campaign: { id: 'campaign-1', name: 'ปีงบประมาณ 2569' },
  fiscalYear: 2569,
  periodStart: '2025-10-01',
  periodEnd: '2026-09-30',
  dashboard,
  previousYear: null,
  includeComments: false,
  commentCount: 8,
})

assert.equal(report.formCode, 'FM-QP-LAB-09-01')
assert.equal(report.versionLabel, 'Version 2')
assert.equal(report.fiscalYear, 2569)
assert.equal(report.periodLabel, '1 ต.ค. 2568 – 30 ก.ย. 2569')
assert.match(report.formula, /sum\(score\)/)
assert.equal(report.responseCount, 20)
assert.equal(report.previousYear, null)
assert.equal(report.comments.included, false)
assert.equal(report.comments.count, 8)

const compared = buildAnnualReportModel({
  survey: { code: 'F', title: 'Form' }, versionNumber: 1,
  campaign: { id: 'c', name: 'รอบ' }, fiscalYear: 2570,
  periodStart: '2026-10-01', periodEnd: '2027-09-30', dashboard,
  previousYear: { fiscalYear: 2569, normalizedPct: 80, responseCount: 12 },
  includeComments: true, commentCount: 2,
})
assert.equal(compared.previousYear?.normalizedPct, 80)
assert.equal(compared.changeFromPreviousPct, 6.5)
assert.equal(compared.comments.included, true)

console.log('report tests passed')
