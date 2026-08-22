import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { SatisfactionCampaignListItem } from '@/lib/supabase/types'
import {
  assertCampaignUpdatePolicy,
  campaignDisplayName,
  createPublicToken,
  thaiFiscalYearPeriod,
  type CampaignUpdatePolicyPatch,
} from './campaign'
import type { SurveyCampaign } from './types'

const fail = (error: { message: string; code?: string } | null) => {
  if (!error) return
  if (error.code === '23505') {
    throw new Error('ปีงบประมาณ หน่วยงาน หรือชุด KPI นี้ถูกใช้กับรอบหรือค่าความพึงพอใจอื่นแล้ว')
  }
  throw new Error(error.message)
}

export async function createCampaign(input: {
  surveyId: string
  surveyVersionId: string
  fiscalYear: number
  departmentId: number
  targetResponseCount?: number
  kpiMetricCode: string
  responseLimit?: number | null
  onePerDevice: boolean
  actorId: string
}) {
  const { data: version, error: versionError } = await supabaseAdmin
    .from('survey_versions').select('id, survey_id, status').eq('id', input.surveyVersionId).maybeSingle()
  fail(versionError)
  if (!version || version.survey_id !== input.surveyId || version.status !== 'published') {
    throw new Error('สร้างรอบได้เฉพาะเวอร์ชันที่เผยแพร่แล้ว')
  }
  const [department, metric] = await Promise.all([
    getActiveDepartment(input.departmentId),
    getActiveKpiMetric(input.kpiMetricCode),
  ])
  await assertCampaignSlotsAvailable({
    surveyId: input.surveyId,
    fiscalYear: input.fiscalYear,
    departmentId: input.departmentId,
    kpiMetricCode: metric.code,
  })
  const period = thaiFiscalYearPeriod(input.fiscalYear)
  const { data, error } = await supabaseAdmin.from('survey_campaigns').insert({
    survey_id: input.surveyId,
    survey_version_id: input.surveyVersionId,
    fiscal_year: input.fiscalYear,
    department_id: input.departmentId,
    target_response_count: input.targetResponseCount ?? null,
    kpi_metric_code: metric.code,
    name: campaignDisplayName(input.fiscalYear, department.name_th),
    public_token: createPublicToken(),
    status: 'draft',
    opens_at: period.opensAt,
    closes_at: period.closesAt,
    response_limit: input.responseLimit ?? null,
    one_per_device: input.onePerDevice,
    created_by: input.actorId,
  }).select('id').single()
  fail(error)
  return { id: data!.id }
}

type DepartmentRow = { id: number; code: string; name_th: string; is_active: boolean }
type KpiMetricRow = { code: string; name: string; target: number; is_active: boolean }

async function getActiveDepartment(departmentId: number): Promise<DepartmentRow> {
  const { data, error } = await supabaseAdmin.from('departments')
    .select('id, code, name_th, is_active').eq('id', departmentId).maybeSingle()
  fail(error)
  if (!data || !data.is_active) throw new Error('ไม่พบหน่วยงานที่เปิดใช้งาน')
  return data as DepartmentRow
}

async function getActiveKpiMetric(metricCode: string): Promise<KpiMetricRow> {
  const { data, error } = await supabaseAdmin.from('kpi_satisfaction_metrics')
    .select('code, name, target, is_active').eq('code', metricCode).maybeSingle()
  fail(error)
  if (!data || !data.is_active) throw new Error('ไม่พบชุด KPI ความพึงพอใจที่เปิดใช้งาน')
  return {
    code: String(data.code),
    name: String(data.name),
    target: Number(data.target),
    is_active: Boolean(data.is_active),
  }
}

async function assertCampaignSlotsAvailable(input: {
  surveyId: string
  fiscalYear: number
  departmentId: number
  kpiMetricCode: string
  excludeCampaignId?: string
}) {
  let surveySlotQuery = supabaseAdmin.from('survey_campaigns').select('id')
    .eq('survey_id', input.surveyId)
    .eq('department_id', input.departmentId)
    .eq('fiscal_year', input.fiscalYear)
  let metricSlotQuery = supabaseAdmin.from('survey_campaigns').select('id')
    .eq('kpi_metric_code', input.kpiMetricCode)
    .eq('fiscal_year', input.fiscalYear)
  if (input.excludeCampaignId) {
    surveySlotQuery = surveySlotQuery.neq('id', input.excludeCampaignId)
    metricSlotQuery = metricSlotQuery.neq('id', input.excludeCampaignId)
  }
  const [surveySlot, metricSlot, existingKpi] = await Promise.all([
    surveySlotQuery.limit(1).maybeSingle(),
    metricSlotQuery.limit(1).maybeSingle(),
    supabaseAdmin.from('kpi_satisfaction').select('id')
      .eq('metric_code', input.kpiMetricCode)
      .eq('fiscal_year', input.fiscalYear)
      .not('value', 'is', null)
      .limit(1).maybeSingle(),
  ])
  fail(surveySlot.error); fail(metricSlot.error); fail(existingKpi.error)
  if (surveySlot.data) throw new Error('แบบสำรวจนี้มีรอบของหน่วยงานและปีงบประมาณเดียวกันแล้ว')
  if (metricSlot.data) throw new Error('ชุด KPI นี้ถูกผูกกับรอบอื่นในปีงบประมาณเดียวกันแล้ว')
  if (existingKpi.data) throw new Error('ชุด KPI และปีงบประมาณนี้มีผลอยู่แล้ว ระบบจะไม่เขียนทับข้อมูลเดิม')
}

export async function updateCampaign(campaignId: string, patch: CampaignUpdatePolicyPatch) {
  const { data: current, error: currentError } = await supabaseAdmin
    .from('survey_campaigns').select('*').eq('id', campaignId).maybeSingle()
  fail(currentError)
  if (!current) throw new Error('ไม่พบรอบเก็บข้อมูล')
  const campaign: SurveyCampaign = {
    id: current.id,
    surveyId: current.survey_id,
    surveyVersionId: current.survey_version_id,
    name: current.name,
    publicToken: current.public_token,
    status: current.status,
    fiscalYear: current.fiscal_year,
    departmentId: current.department_id,
    targetResponseCount: current.target_response_count,
    kpiMetricCode: current.kpi_metric_code,
    opensAt: current.opens_at,
    closesAt: current.closes_at,
    responseLimit: current.response_limit,
    responseCount: current.response_count,
    onePerDevice: current.one_per_device,
  }
  assertCampaignUpdatePolicy(campaign, patch)

  const fiscalYear = patch.fiscalYear ?? campaign.fiscalYear
  const departmentId = patch.departmentId ?? campaign.departmentId
  const kpiMetricCode = patch.kpiMetricCode ?? campaign.kpiMetricCode
  const metadataChanged = patch.fiscalYear !== undefined
    || patch.departmentId !== undefined
    || patch.kpiMetricCode !== undefined
  const opening = patch.status === 'open' && current.status === 'draft'

  let department: DepartmentRow | null = null
  if (patch.departmentId !== undefined || opening) {
    if (departmentId === null) throw new Error('กรุณากำหนดหน่วยงานก่อนเปิดรับคำตอบ')
    department = await getActiveDepartment(departmentId)
  }
  if (patch.kpiMetricCode !== undefined || opening) {
    if (!kpiMetricCode) throw new Error('กรุณากำหนด KPI ก่อนเปิดรับคำตอบ')
    await getActiveKpiMetric(kpiMetricCode)
  }
  if (metadataChanged || opening) {
    if (fiscalYear === null || departmentId === null || !kpiMetricCode) {
      throw new Error('ข้อมูลปีงบประมาณ หน่วยงาน และ KPI ของรอบยังไม่ครบ')
    }
    await assertCampaignSlotsAvailable({
      surveyId: campaign.surveyId,
      fiscalYear,
      departmentId,
      kpiMetricCode,
      excludeCampaignId: campaignId,
    })
  }

  const period = patch.fiscalYear === undefined ? null : thaiFiscalYearPeriod(patch.fiscalYear)
  if (patch.departmentId !== undefined && !department) department = await getActiveDepartment(patch.departmentId)
  const generatedName = (patch.fiscalYear !== undefined || patch.departmentId !== undefined)
    && fiscalYear !== null && departmentId !== null
    ? campaignDisplayName(
        fiscalYear,
        department?.name_th ?? (await getActiveDepartment(departmentId)).name_th,
      )
    : null
  const { error } = await supabaseAdmin.from('survey_campaigns').update({
    ...(patch.fiscalYear !== undefined ? {
      fiscal_year: patch.fiscalYear,
      opens_at: period!.opensAt,
      closes_at: period!.closesAt,
    } : {}),
    ...(patch.departmentId !== undefined ? { department_id: patch.departmentId } : {}),
    ...(patch.targetResponseCount !== undefined ? { target_response_count: patch.targetResponseCount } : {}),
    ...(patch.kpiMetricCode !== undefined ? { kpi_metric_code: patch.kpiMetricCode } : {}),
    ...(generatedName !== null ? { name: generatedName } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.responseLimit !== undefined ? { response_limit: patch.responseLimit } : {}),
    ...(patch.onePerDevice !== undefined ? { one_per_device: patch.onePerDevice } : {}),
    ...(patch.status === 'closed' ? { closed_at: new Date().toISOString() } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', campaignId)
  fail(error)
}

export async function deleteCampaign(campaignId: string) {
  const { data: current, error: currentError } = await supabaseAdmin
    .from('survey_campaigns').select('id').eq('id', campaignId).maybeSingle()
  fail(currentError)
  if (!current) throw new Error('ไม่พบรอบเก็บข้อมูล')

  const { count: responseCount, error: responseError } = await supabaseAdmin
    .from('survey_responses').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId)
  fail(responseError)
  if ((responseCount ?? 0) > 0) throw new Error('ลบไม่ได้ เพราะรอบนี้มีคำตอบแล้ว')

  const { count: kpiCount, error: kpiError } = await supabaseAdmin
    .from('survey_kpi_publications').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId)
  fail(kpiError)
  if ((kpiCount ?? 0) > 0) throw new Error('ลบไม่ได้ เพราะรอบนี้ถูกส่งขึ้น KPI แล้ว')

  const { error } = await supabaseAdmin.from('survey_campaigns').delete().eq('id', campaignId)
  fail(error)
}

export async function rotateCampaignToken(campaignId: string) {
  const { data, error } = await supabaseAdmin.from('survey_campaigns').update({
    public_token: createPublicToken(), updated_at: new Date().toISOString(),
  }).eq('id', campaignId).neq('status', 'closed').select('public_token').maybeSingle()
  fail(error)
  if (!data) throw new Error('ไม่สามารถเปลี่ยน token ของรอบที่ปิดแล้ว')
  return data.public_token as string
}

export type CampaignMutationResult = Pick<SatisfactionCampaignListItem, 'id'>
