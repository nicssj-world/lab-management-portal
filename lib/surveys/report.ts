import type { SurveyDashboardData } from './aggregates'

export type AnnualSurveyReport = {
  formCode: string
  formTitle: string
  versionLabel: string
  campaignId: string
  campaignName: string
  department: { id: number; code: string; name: string }
  fiscalYear: number
  periodLabel: string
  formula: string
  responseCount: number
  targetResponseCount: number | null
  targetProgressPct: number | null
  overall: SurveyDashboardData['overall']
  sections: SurveyDashboardData['sections']
  distribution: SurveyDashboardData['overall']['distribution']
  previousYear: { fiscalYear: number; normalizedPct: number | null; responseCount: number } | null
  changeFromPreviousPct: number | null
  comments: { included: boolean; count: number }
  generatedAt: string
}

const thaiDate = (value: string) => new Intl.DateTimeFormat('th-TH', {
  timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
}).format(new Date(`${value}T00:00:00.000Z`))

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function buildAnnualReportModel(input: {
  survey: { code: string; title: string }
  versionNumber: number
  campaign: {
    id: string
    name: string
    department: { id: number; code: string; name: string }
    targetResponseCount: number | null
  }
  fiscalYear: number
  periodStart: string
  periodEnd: string
  dashboard: SurveyDashboardData
  previousYear: { fiscalYear: number; normalizedPct: number | null; responseCount: number } | null
  includeComments: boolean
  commentCount: number
}): AnnualSurveyReport {
  const current = input.dashboard.overall.normalizedPct
  const previous = input.previousYear?.normalizedPct ?? null
  return {
    formCode: input.survey.code,
    formTitle: input.survey.title,
    versionLabel: `Version ${input.versionNumber}`,
    campaignId: input.campaign.id,
    campaignName: input.campaign.name,
    department: input.campaign.department,
    fiscalYear: input.fiscalYear,
    periodLabel: `${thaiDate(input.periodStart)} – ${thaiDate(input.periodEnd)}`,
    formula: 'Normalized satisfaction (%) = sum(score) / sum(max score for each answered scored question) × 100; optional missing answers are excluded.',
    responseCount: input.dashboard.responseCount,
    targetResponseCount: input.campaign.targetResponseCount,
    targetProgressPct: input.campaign.targetResponseCount === null
      ? null
      : round2((input.dashboard.responseCount / input.campaign.targetResponseCount) * 100),
    overall: input.dashboard.overall,
    sections: input.dashboard.sections,
    distribution: input.dashboard.overall.distribution,
    previousYear: input.previousYear,
    changeFromPreviousPct: current === null || previous === null ? null : round2(current - previous),
    comments: { included: input.includeComments, count: input.commentCount },
    generatedAt: new Date().toISOString(),
  }
}
