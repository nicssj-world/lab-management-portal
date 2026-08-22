import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildMetricCode } from './satisfaction-save'
import { canDeactivateSatisfactionMetric, getManualValueConflict } from './satisfaction-policy'
import type {
  BuildSatisfactionDashboardInput,
  SatisfactionDashboardCampaignRecord,
  SatisfactionDashboardMetricRecord,
  SatisfactionDashboardPublicationRecord,
  SatisfactionDashboardValueRecord,
} from './satisfaction-dashboard'
import type {
  ValidatedManualSatisfactionValue,
  ValidatedSatisfactionMetricCreate,
  ValidatedSatisfactionMetricPatch,
} from './satisfaction-validation'

export type SatisfactionRepositoryErrorCode =
  | 'metric_not_found'
  | 'metric_code_conflict'
  | 'metric_inactive'
  | 'metric_linked_to_active_campaign'
  | 'campaign_reserved'
  | 'survey_published'
  | 'manual_value_conflict'
  | 'storage_error'

export class SatisfactionRepositoryError extends Error {
  constructor(
    public readonly code: SatisfactionRepositoryErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'SatisfactionRepositoryError'
  }
}

type DatabaseResult = { error: { code?: string; message: string } | null }

function failDatabase(result: DatabaseResult, operation: string): void {
  if (!result.error) return
  throw new SatisfactionRepositoryError('storage_error', `ไม่สามารถ${operation}ได้ กรุณาลองใหม่`, result.error)
}

function relationOne(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function requiredNumber(value: unknown, field: string): number {
  const number = nullableNumber(value)
  if (number === null) {
    throw new SatisfactionRepositoryError('storage_error', `ข้อมูล ${field} ในฐานข้อมูลไม่ถูกต้อง`)
  }
  return number
}

function metricRecord(row: Record<string, unknown>): SatisfactionDashboardMetricRecord {
  return {
    code: String(row.code),
    name: String(row.name),
    target: requiredNumber(row.target, 'เป้าหมาย KPI'),
    isActive: row.is_active === true,
  }
}

export interface SatisfactionMetricCatalogItem extends SatisfactionDashboardMetricRecord {
  createdAt: string
  updatedAt: string
  campaignCount: number
  historyCount: number
}

export async function loadSatisfactionDashboardRecords(): Promise<
  Pick<BuildSatisfactionDashboardInput, 'metrics' | 'values' | 'publications' | 'campaigns'>
> {
  const [metricResult, valueResult, publicationResult, campaignResult] = await Promise.all([
    supabaseAdmin.from('kpi_satisfaction_metrics').select('code, name, target, is_active, created_at, updated_at').order('code'),
    supabaseAdmin.from('kpi_satisfaction').select('metric_code, fiscal_year, value, source_note').order('fiscal_year', { ascending: false }),
    supabaseAdmin.from('survey_kpi_publications').select('metric_code, fiscal_year, campaign_id, response_count, published_at, publisher:profiles!survey_kpi_publications_published_by_fkey(name)').order('fiscal_year', { ascending: false }),
    supabaseAdmin.from('survey_campaigns').select('id, name, status, fiscal_year, kpi_metric_code, departments(name_th), surveys(code)'),
  ])
  failDatabase(metricResult, 'โหลดชุดตัวชี้วัด')
  failDatabase(valueResult, 'โหลดประวัติ KPI')
  failDatabase(publicationResult, 'โหลดแหล่งข้อมูลแบบสำรวจ')
  failDatabase(campaignResult, 'โหลดข้อมูลรอบแบบสำรวจ')

  const metrics = ((metricResult.data ?? []) as Array<Record<string, unknown>>).map(metricRecord)
  const values = ((valueResult.data ?? []) as Array<Record<string, unknown>>).map<SatisfactionDashboardValueRecord>((row) => ({
    metricCode: String(row.metric_code),
    fiscalYear: requiredNumber(row.fiscal_year, 'ปีงบประมาณ KPI'),
    value: nullableNumber(row.value),
    sourceNote: row.source_note == null ? null : String(row.source_note),
  }))
  const publications = ((publicationResult.data ?? []) as Array<Record<string, unknown>>).map<SatisfactionDashboardPublicationRecord>((row) => {
    const publisher = relationOne(row.publisher)
    return {
      metricCode: String(row.metric_code),
      fiscalYear: requiredNumber(row.fiscal_year, 'ปีงบประมาณการเผยแพร่'),
      campaignId: String(row.campaign_id),
      responseCount: requiredNumber(row.response_count, 'จำนวนคำตอบ'),
      publishedAt: String(row.published_at),
      publishedByName: publisher?.name == null ? null : String(publisher.name),
    }
  })
  const campaigns = ((campaignResult.data ?? []) as Array<Record<string, unknown>>).map<SatisfactionDashboardCampaignRecord>((row) => {
    const department = relationOne(row.departments)
    const survey = relationOne(row.surveys)
    const status = row.status === 'open' || row.status === 'closed' ? row.status : 'draft'
    return {
      id: String(row.id),
      metricCode: row.kpi_metric_code == null ? null : String(row.kpi_metric_code),
      fiscalYear: nullableNumber(row.fiscal_year),
      status,
      name: String(row.name),
      departmentName: department?.name_th == null ? null : String(department.name_th),
      surveyCode: survey?.code == null ? null : String(survey.code),
    }
  })
  return { metrics, values, publications, campaigns }
}

export async function listSatisfactionMetricCatalog(): Promise<SatisfactionMetricCatalogItem[]> {
  const [metricResult, campaignResult, historyResult] = await Promise.all([
    supabaseAdmin.from('kpi_satisfaction_metrics').select('code, name, target, is_active, created_at, updated_at').order('code'),
    supabaseAdmin.from('survey_campaigns').select('kpi_metric_code').not('kpi_metric_code', 'is', null),
    supabaseAdmin.from('kpi_satisfaction').select('metric_code'),
  ])
  failDatabase(metricResult, 'โหลดชุดตัวชี้วัด')
  failDatabase(campaignResult, 'นับรอบแบบสำรวจ')
  failDatabase(historyResult, 'นับประวัติ KPI')

  const campaignCounts = new Map<string, number>()
  for (const row of (campaignResult.data ?? []) as Array<{ kpi_metric_code: string | null }>) {
    if (row.kpi_metric_code) campaignCounts.set(row.kpi_metric_code, (campaignCounts.get(row.kpi_metric_code) ?? 0) + 1)
  }
  const historyCounts = new Map<string, number>()
  for (const row of (historyResult.data ?? []) as Array<{ metric_code: string }>) {
    historyCounts.set(row.metric_code, (historyCounts.get(row.metric_code) ?? 0) + 1)
  }
  return ((metricResult.data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const metric = metricRecord(row)
    return {
      ...metric,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      campaignCount: campaignCounts.get(metric.code) ?? 0,
      historyCount: historyCounts.get(metric.code) ?? 0,
    }
  })
}

export async function createSatisfactionMetric(input: ValidatedSatisfactionMetricCreate): Promise<SatisfactionMetricCatalogItem> {
  const existingResult = await supabaseAdmin.from('kpi_satisfaction_metrics').select('code')
  failDatabase(existingResult, 'ตรวจรหัสชุดตัวชี้วัด')
  const code = buildMetricCode(input.name, new Set(((existingResult.data ?? []) as Array<{ code: string }>).map((row) => row.code)))
  const result = await supabaseAdmin.from('kpi_satisfaction_metrics').insert({
    code, name: input.name, target: input.target, is_active: true,
  }).select('code, name, target, is_active, created_at, updated_at').single()
  if (result.error?.code === '23505') {
    throw new SatisfactionRepositoryError('metric_code_conflict', 'มีรหัสชุดตัวชี้วัดนี้แล้ว กรุณาลองสร้างอีกครั้ง', result.error)
  }
  failDatabase(result, 'สร้างชุดตัวชี้วัด')
  const metric = metricRecord(result.data as unknown as Record<string, unknown>)
  return {
    ...metric,
    createdAt: String(result.data!.created_at),
    updatedAt: String(result.data!.updated_at),
    campaignCount: 0,
    historyCount: 0,
  }
}

export async function updateSatisfactionMetric(input: ValidatedSatisfactionMetricPatch): Promise<SatisfactionMetricCatalogItem> {
  const currentResult = await supabaseAdmin.from('kpi_satisfaction_metrics')
    .select('code, name, target, is_active, created_at, updated_at').eq('code', input.code).maybeSingle()
  failDatabase(currentResult, 'ค้นหาชุดตัวชี้วัด')
  if (!currentResult.data) throw new SatisfactionRepositoryError('metric_not_found', 'ไม่พบชุดตัวชี้วัดที่ต้องการแก้ไข')

  if (input.isActive === false && currentResult.data.is_active) {
    const linkedResult = await supabaseAdmin.from('survey_campaigns').select('status')
      .eq('kpi_metric_code', input.code).neq('status', 'closed')
    failDatabase(linkedResult, 'ตรวจรอบแบบสำรวจที่เชื่อมอยู่')
    const statuses = ((linkedResult.data ?? []) as Array<{ status: string }>).map((row) => row.status)
    if (!canDeactivateSatisfactionMetric(statuses)) {
      throw new SatisfactionRepositoryError('metric_linked_to_active_campaign', 'ปิดใช้งานไม่ได้ เพราะชุดตัวชี้วัดนี้ยังผูกกับรอบแบบสำรวจที่ยังไม่ปิด')
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name !== undefined) patch.name = input.name
  if (input.target !== undefined) patch.target = input.target
  if (input.isActive !== undefined) patch.is_active = input.isActive
  const result = await supabaseAdmin.from('kpi_satisfaction_metrics').update(patch).eq('code', input.code)
    .select('code, name, target, is_active, created_at, updated_at').single()
  failDatabase(result, 'แก้ไขชุดตัวชี้วัด')

  const [campaignCountResult, historyCountResult] = await Promise.all([
    supabaseAdmin.from('survey_campaigns').select('id', { count: 'exact', head: true }).eq('kpi_metric_code', input.code),
    supabaseAdmin.from('kpi_satisfaction').select('id', { count: 'exact', head: true }).eq('metric_code', input.code),
  ])
  failDatabase(campaignCountResult, 'นับรอบแบบสำรวจ')
  failDatabase(historyCountResult, 'นับประวัติ KPI')
  const metric = metricRecord(result.data as unknown as Record<string, unknown>)
  return {
    ...metric,
    createdAt: String(result.data!.created_at),
    updatedAt: String(result.data!.updated_at),
    campaignCount: campaignCountResult.count ?? 0,
    historyCount: historyCountResult.count ?? 0,
  }
}

export async function saveManualSatisfactionValue(input: ValidatedManualSatisfactionValue) {
  const metricResult = await supabaseAdmin.from('kpi_satisfaction_metrics')
    .select('code, name, target, is_active').eq('code', input.metricCode).maybeSingle()
  failDatabase(metricResult, 'ค้นหาชุดตัวชี้วัด')
  if (!metricResult.data) throw new SatisfactionRepositoryError('metric_not_found', 'ไม่พบชุดตัวชี้วัดที่เลือก')
  if (!metricResult.data.is_active) {
    throw new SatisfactionRepositoryError('metric_inactive', 'ชุดตัวชี้วัดนี้ปิดใช้งานแล้ว จึงเพิ่มข้อมูลใหม่ไม่ได้')
  }

  // Read the value first, then its source lock. If a survey publication commits
  // between these reads, the publication query sees it; if it commits later,
  // our insert loses on the metric/year unique key instead of overwriting it.
  const existingValueResult = await supabaseAdmin.from('kpi_satisfaction').select('id')
    .eq('metric_code', input.metricCode).eq('fiscal_year', input.fiscalYear).maybeSingle()
  failDatabase(existingValueResult, 'ตรวจค่าความพึงพอใจเดิม')
  const [campaignResult, publicationResult] = await Promise.all([
    supabaseAdmin.from('survey_campaigns').select('id, status').eq('kpi_metric_code', input.metricCode)
      .eq('fiscal_year', input.fiscalYear).limit(1).maybeSingle(),
    supabaseAdmin.from('survey_kpi_publications').select('id, campaign_id').eq('metric_code', input.metricCode)
      .eq('fiscal_year', input.fiscalYear).limit(1).maybeSingle(),
  ])
  failDatabase(campaignResult, 'ตรวจรอบแบบสำรวจที่จอง KPI')
  failDatabase(publicationResult, 'ตรวจผลที่เผยแพร่จากแบบสำรวจ')
  const conflict = getManualValueConflict({
    campaignReserved: Boolean(campaignResult.data),
    surveyPublicationExists: Boolean(publicationResult.data),
  })
  if (conflict === 'survey_published') {
    throw new SatisfactionRepositoryError('survey_published', 'ค่านี้เผยแพร่จากแบบสำรวจแล้ว จึงแก้ไขจากหน้ากรอกข้อมูลไม่ได้')
  }
  if (conflict === 'campaign_reserved') {
    throw new SatisfactionRepositoryError('campaign_reserved', 'ชุดตัวชี้วัดและปีนี้ถูกจองโดยรอบแบบสำรวจแล้ว กรุณาบันทึกผลผ่านการเผยแพร่รอบแบบสำรวจ')
  }

  const writeData = {
    metric_code: input.metricCode,
    metric_name: metricResult.data.name,
    fiscal_year: input.fiscalYear,
    value: input.value,
    target_val: metricResult.data.target,
    source_note: input.sourceNote,
    updated_at: new Date().toISOString(),
  }
  const result = existingValueResult.data
    ? await supabaseAdmin.from('kpi_satisfaction').update(writeData).eq('id', existingValueResult.data.id)
      .select('metric_code, fiscal_year, value, source_note, updated_at').single()
    : await supabaseAdmin.from('kpi_satisfaction').insert(writeData)
      .select('metric_code, fiscal_year, value, source_note, updated_at').single()
  if (result.error?.code === '23505') {
    throw new SatisfactionRepositoryError(
      'manual_value_conflict',
      'มีการบันทึกหรือเผยแพร่ค่า KPI นี้พร้อมกัน กรุณาโหลดข้อมูลใหม่ก่อนลองอีกครั้ง',
      result.error,
    )
  }
  failDatabase(result, 'บันทึกค่าความพึงพอใจ')
  return {
    metricCode: String(result.data!.metric_code),
    fiscalYear: requiredNumber(result.data!.fiscal_year, 'ปีงบประมาณ KPI'),
    value: requiredNumber(result.data!.value, 'ค่าความพึงพอใจ'),
    source: 'manual' as const,
    sourceNote: String(result.data!.source_note),
    updatedAt: String(result.data!.updated_at),
  }
}

export async function auditSatisfactionChange(input: {
  action: string
  actorId: string
  target: string
  detail: Record<string, unknown>
}): Promise<void> {
  const { error } = await supabaseAdmin.from('audit_log').insert({
    action: input.action,
    user_id: input.actorId,
    target: input.target,
    detail: JSON.stringify(input.detail),
  })
  if (error) console.error('KPI satisfaction audit failed:', error.message)
}
