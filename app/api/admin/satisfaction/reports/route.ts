import { NextResponse } from 'next/server'
import { requireSatisfaction } from '@/lib/surveys/guard'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getSurveyDashboardData } from '@/lib/surveys/dashboard-server'
import { buildAnnualReportModel } from '@/lib/surveys/report'
import { thaiFiscalYearPeriod } from '@/lib/surveys/campaign'

export async function GET(request: Request) {
  const access = await requireSatisfaction('view')
  if (access.response) return access.response
  const params = new URL(request.url).searchParams
  const campaignId = params.get('campaignId')
  const requestedComments = params.get('includeComments') === 'true'
  const canExportComments = access.actor.role === 'Admin' || access.actor.role === 'Manager'
  if (!campaignId) return NextResponse.json({ error: 'กรุณาระบุรอบเก็บข้อมูล' }, { status: 400 })
  if (requestedComments && !canExportComments) return NextResponse.json({ error: 'ไม่มีสิทธิ์ส่งออกความคิดเห็น' }, { status: 403 })
  const { data: campaign, error } = await supabaseAdmin.from('survey_campaigns')
    .select('id, name, survey_id, survey_version_id, fiscal_year, department_id, target_response_count, departments(code, name_th), surveys(code, title), survey_versions(version_number)')
    .eq('id', campaignId).maybeSingle()
  if (error || !campaign) return NextResponse.json({ error: error?.message ?? 'ไม่พบรอบเก็บข้อมูล' }, { status: 404 })
  if (campaign.fiscal_year === null || campaign.department_id === null) {
    return NextResponse.json({ error: 'รอบนี้ยังไม่ได้กำหนดปีงบประมาณและหน่วยงาน' }, { status: 409 })
  }
  if (!campaign.departments) {
    return NextResponse.json({ error: 'ไม่พบหน่วยงานที่ผูกกับรอบนี้ กรุณาตรวจสอบข้อมูลรอบ' }, { status: 409 })
  }
  const fiscalYear = Number(campaign.fiscal_year)
  const period = thaiFiscalYearPeriod(fiscalYear)
  const dashboardResult = await getSurveyDashboardData({
    campaignId,
    from: period.opensAt,
    toExclusive: period.closesAt,
    grouping: 'month',
  })
  const { count: commentCount } = await supabaseAdmin.from('survey_answers').select('*', { head: true, count: 'exact' }).eq('campaign_id', campaignId).eq('is_comment', true).not('text_value', 'is', null)
  const { data: previousCampaign } = await supabaseAdmin.from('survey_campaigns')
    .select('id')
    .eq('survey_id', campaign.survey_id)
    .eq('department_id', campaign.department_id)
    .eq('fiscal_year', fiscalYear - 1)
    .maybeSingle()
  const { data: previous } = previousCampaign
    ? await supabaseAdmin.from('survey_kpi_publications')
      .select('fiscal_year, normalized_pct, response_count')
      .eq('campaign_id', previousCampaign.id)
      .eq('fiscal_year', fiscalYear - 1)
      .maybeSingle()
    : { data: null }
  const survey = campaign.surveys as unknown as { code: string; title: string }
  const version = campaign.survey_versions as unknown as { version_number: number }
  const department = campaign.departments as unknown as { code: string; name_th: string }
  const report = buildAnnualReportModel({
    survey,
    versionNumber: version.version_number,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      department: { id: campaign.department_id, code: department.code, name: department.name_th },
      targetResponseCount: campaign.target_response_count,
    },
    fiscalYear,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    dashboard: dashboardResult.data,
    previousYear: previous ? { fiscalYear: previous.fiscal_year, normalizedPct: Number(previous.normalized_pct), responseCount: previous.response_count } : null,
    includeComments: requestedComments,
    commentCount: commentCount ?? 0,
  })
  void supabaseAdmin.from('audit_log').insert({ action: 'satisfaction.report.export', user_id: access.actor.id, target: campaignId, detail: JSON.stringify({ fiscalYear, responseCount: report.responseCount, includeComments: requestedComments }) })
  return NextResponse.json({ report })
}
