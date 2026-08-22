export type SatisfactionValueSource = 'survey' | 'manual'
export type SatisfactionMetricStatus = 'pass' | 'below' | 'missing'

export interface SatisfactionDashboardMetricRecord {
  code: string
  name: string
  target: number
  isActive: boolean
}

export interface SatisfactionDashboardValueRecord {
  metricCode: string
  fiscalYear: number
  value: number | null
  sourceNote: string | null
}

export interface SatisfactionDashboardPublicationRecord {
  metricCode: string
  fiscalYear: number
  campaignId: string
  responseCount: number
  publishedAt: string
  publishedByName: string | null
}

export interface SatisfactionDashboardCampaignRecord {
  id: string
  metricCode: string | null
  fiscalYear: number | null
  status: 'draft' | 'open' | 'closed'
  name: string
  departmentName: string | null
  surveyCode: string | null
}

export interface SatisfactionDashboardFilters {
  metricCode?: string
  source?: SatisfactionValueSource
  status?: SatisfactionMetricStatus
}

export interface SatisfactionDashboardHistoryItem {
  fiscalYear: number
  value: number | null
  source: SatisfactionValueSource
  sourceNote: string | null
  responseCount: number | null
  campaignId: string | null
  publishedAt: string | null
  publishedByName: string | null
}

export interface SatisfactionDashboardCurrentValue extends SatisfactionDashboardHistoryItem {
  campaignName: string | null
  departmentName: string | null
  surveyCode: string | null
}

export interface SatisfactionDashboardMetric {
  code: string
  name: string
  target: number
  isActive: boolean
  status: SatisfactionMetricStatus
  current: SatisfactionDashboardCurrentValue | null
  previousValue: number | null
  delta: number | null
  history: SatisfactionDashboardHistoryItem[]
}

export interface SatisfactionDashboardDto {
  fiscalYear: number
  years: number[]
  summary: {
    activeMetrics: number
    pass: number
    below: number
    missing: number
    pendingPublication: number
  }
  metrics: SatisfactionDashboardMetric[]
}

export interface BuildSatisfactionDashboardInput {
  fiscalYear: number
  metrics: SatisfactionDashboardMetricRecord[]
  values: SatisfactionDashboardValueRecord[]
  publications: SatisfactionDashboardPublicationRecord[]
  campaigns: SatisfactionDashboardCampaignRecord[]
  filters?: SatisfactionDashboardFilters
}

const metricYearKey = (metricCode: string, fiscalYear: number) => `${metricCode}\u0000${fiscalYear}`

export function getThaiFiscalYear(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date)
  const gregorianYear = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  return gregorianYear + 543 + (month >= 10 ? 1 : 0)
}

export function getSatisfactionStatus(value: number | null, target: number): SatisfactionMetricStatus {
  if (value === null) return 'missing'
  return value >= target ? 'pass' : 'below'
}

function roundDelta(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function compareMetricCode(a: SatisfactionDashboardMetric, b: SatisfactionDashboardMetric): number {
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0
}

export function filterSatisfactionDashboardMetrics(
  metrics: SatisfactionDashboardMetric[],
  filters: SatisfactionDashboardFilters = {},
): SatisfactionDashboardMetric[] {
  return metrics.filter((metric) => {
    if (filters.metricCode && metric.code !== filters.metricCode) return false
    if (filters.status && metric.status !== filters.status) return false
    if (filters.source && metric.current?.source !== filters.source) return false
    return true
  })
}

export function summarizeSatisfactionDashboardMetrics(metrics: SatisfactionDashboardMetric[]) {
  const active = metrics.filter((metric) => metric.isActive)
  return {
    activeMetrics: active.length,
    pass: active.filter((metric) => metric.status === 'pass').length,
    below: active.filter((metric) => metric.status === 'below').length,
    missing: active.filter((metric) => metric.status === 'missing').length,
  }
}

export function buildSatisfactionDashboard(input: BuildSatisfactionDashboardInput): SatisfactionDashboardDto {
  const resultValues = input.values.filter((value) => value.value !== null)
  const publicationsByMetricYear = new Map(
    input.publications.map((publication) => [
      metricYearKey(publication.metricCode, publication.fiscalYear),
      publication,
    ]),
  )
  const campaignsById = new Map(input.campaigns.map((campaign) => [campaign.id, campaign]))
  const valuesByMetric = new Map<string, SatisfactionDashboardValueRecord[]>()
  for (const value of resultValues) {
    const rows = valuesByMetric.get(value.metricCode) ?? []
    rows.push(value)
    valuesByMetric.set(value.metricCode, rows)
  }

  const metrics = input.metrics.map<SatisfactionDashboardMetric>((metric) => {
    const metricValues = [...(valuesByMetric.get(metric.code) ?? [])]
      .sort((a, b) => b.fiscalYear - a.fiscalYear)
    const history = metricValues.map<SatisfactionDashboardHistoryItem>((row) => {
      const publication = publicationsByMetricYear.get(metricYearKey(metric.code, row.fiscalYear))
      return {
        fiscalYear: row.fiscalYear,
        value: row.value,
        source: publication ? 'survey' : 'manual',
        sourceNote: row.sourceNote,
        responseCount: publication?.responseCount ?? null,
        campaignId: publication?.campaignId ?? null,
        publishedAt: publication?.publishedAt ?? null,
        publishedByName: publication?.publishedByName ?? null,
      }
    })
    const currentHistory = history.find((row) => row.fiscalYear === input.fiscalYear) ?? null
    const currentPublication = publicationsByMetricYear.get(metricYearKey(metric.code, input.fiscalYear))
    const currentCampaign = currentPublication ? campaignsById.get(currentPublication.campaignId) : undefined
    const current = currentHistory ? {
      ...currentHistory,
      campaignName: currentCampaign?.name ?? null,
      departmentName: currentCampaign?.departmentName ?? null,
      surveyCode: currentCampaign?.surveyCode ?? null,
    } : null
    const previousValue = history.find((row) => row.fiscalYear === input.fiscalYear - 1)?.value ?? null
    const delta = current?.value !== null && current?.value !== undefined && previousValue !== null
      ? roundDelta(current.value - previousValue)
      : null

    return {
      code: metric.code,
      name: metric.name,
      target: metric.target,
      isActive: metric.isActive,
      status: getSatisfactionStatus(current?.value ?? null, metric.target),
      current,
      previousValue,
      delta,
      history,
    }
  }).sort(compareMetricCode)

  const filteredMetrics = filterSatisfactionDashboardMetrics(metrics, input.filters)
  const summary = summarizeSatisfactionDashboardMetrics(filteredMetrics)
  const publishedCampaignIds = new Set(input.publications.map((publication) => publication.campaignId))
  const pendingPublication = input.campaigns.filter((campaign) =>
    campaign.status === 'closed'
      && campaign.fiscalYear === input.fiscalYear
      && campaign.metricCode !== null
      && !publishedCampaignIds.has(campaign.id)
      && (!input.filters?.metricCode || campaign.metricCode === input.filters.metricCode),
  ).length
  const years = [...new Set([
    input.fiscalYear,
    ...resultValues.map((value) => value.fiscalYear),
    ...input.campaigns.flatMap((campaign) => campaign.fiscalYear === null ? [] : [campaign.fiscalYear]),
  ])].sort((a, b) => b - a)

  return {
    fiscalYear: input.fiscalYear,
    years,
    summary: { ...summary, pendingPublication },
    metrics: filteredMetrics,
  }
}
