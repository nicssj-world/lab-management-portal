import { NextResponse } from 'next/server'
import { requireResource } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getSurveyDashboardData } from '@/lib/surveys/dashboard-server'
import { buildAnnualReportModel } from '@/lib/surveys/report'

const fiscalPeriod = (fiscalYear: number) => {
  const gregorianEnd = fiscalYear - 543
  return { start: `${gregorianEnd - 1}-10-01`, end: `${gregorianEnd}-09-30` }
}

export async function GET(request: Request) {
  const access = await requireResource('แบบสำรวจความพึงพอใจ', 'view')
  if (access.response) return access.response
  const params = new URL(request.url).searchParams
  const campaignId = params.get('campaignId')
  const fiscalYear = Number(params.get('fiscalYear'))
  const requestedComments = params.get('includeComments') === 'true'
  const canExportComments = access.actor.role === 'Admin' || access.actor.role === 'Manager'
  if (!campaignId || !Number.isInteger(fiscalYear) || fiscalYear < 2500 || fiscalYear > 3000) {
    return NextResponse.json({ error: 'กรุณาระบุรอบและปีงบประมาณ' }, { status: 400 })
  }
  if (requestedComments && !canExportComments) return NextResponse.json({ error: 'ไม่มีสิทธิ์ส่งออกความคิดเห็น' }, { status: 403 })
  const { data: campaign, error } = await supabaseAdmin.from('survey_campaigns')
    .select('id, name, survey_id, survey_version_id, surveys(code, title), survey_versions(version_number)')
    .eq('id', campaignId).maybeSingle()
  if (error || !campaign) return NextResponse.json({ error: error?.message ?? 'ไม่พบรอบเก็บข้อมูล' }, { status: 404 })
  const period = fiscalPeriod(fiscalYear)
  const dashboardResult = await getSurveyDashboardData({ campaignId, from: `${period.start}T00:00:00+07:00`, to: `${period.end}T23:59:59+07:00`, grouping: 'month' })
  const { count: commentCount } = await supabaseAdmin.from('survey_answers').select('*', { head: true, count: 'exact' }).eq('campaign_id', campaignId).eq('is_comment', true).not('text_value', 'is', null)
  const { data: sameSurveyCampaigns } = await supabaseAdmin.from('survey_campaigns')
    .select('id').eq('survey_id', campaign.survey_id)
  const sameSurveyCampaignIds = (sameSurveyCampaigns ?? []).map((item) => item.id)
  const { data: previous } = sameSurveyCampaignIds.length
    ? await supabaseAdmin.from('survey_kpi_publications')
      .select('fiscal_year, normalized_pct, response_count')
      .in('campaign_id', sameSurveyCampaignIds)
      .eq('fiscal_year', fiscalYear - 1)
      .order('published_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null }
  const survey = campaign.surveys as unknown as { code: string; title: string }
  const version = campaign.survey_versions as unknown as { version_number: number }
  const report = buildAnnualReportModel({
    survey,
    versionNumber: version.version_number,
    campaign: { id: campaign.id, name: campaign.name },
    fiscalYear,
    periodStart: period.start,
    periodEnd: period.end,
    dashboard: dashboardResult.data,
    previousYear: previous ? { fiscalYear: previous.fiscal_year, normalizedPct: Number(previous.normalized_pct), responseCount: previous.response_count } : null,
    includeComments: requestedComments,
    commentCount: commentCount ?? 0,
  })
  void supabaseAdmin.from('audit_log').insert({ action: 'satisfaction.report.export', user_id: access.actor.id, target: campaignId, detail: JSON.stringify({ fiscalYear, responseCount: report.responseCount, includeComments: requestedComments }) })
  return NextResponse.json({ report })
}
