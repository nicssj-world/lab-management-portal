import { NextResponse } from 'next/server'
import { canAccessResource } from '@/lib/auth/guards'
import { requireSatisfaction } from '@/lib/surveys/guard'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getSurveyDashboardData } from '@/lib/surveys/dashboard-server'

type Context = { params: Promise<{ campaignId: string }> }

export async function POST(_request: Request, { params }: Context) {
  const access = await requireSatisfaction('edit')
  if (access.response) return access.response
  const actor = access.actor
  if (!(await canAccessResource(actor, 'KPI', 'edit'))) return NextResponse.json({ error: 'ต้องมีสิทธิ์แก้ไข KPI ด้วย' }, { status: 403 })
  const { campaignId } = await params
  const { data: campaign, error: campaignError } = await supabaseAdmin.from('survey_campaigns')
    .select('id, status, survey_version_id, fiscal_year, kpi_metric_code')
    .eq('id', campaignId).maybeSingle()
  if (campaignError || !campaign) return NextResponse.json({ error: campaignError?.message ?? 'ไม่พบรอบเก็บข้อมูล' }, { status: 404 })
  if (campaign.status !== 'closed') return NextResponse.json({ error: 'ต้องปิดรอบเก็บข้อมูลก่อนเผยแพร่ KPI' }, { status: 409 })
  if (campaign.fiscal_year === null || !campaign.kpi_metric_code) {
    return NextResponse.json({ error: 'รอบนี้ยังไม่ได้กำหนดปีงบประมาณหรือชุด KPI' }, { status: 409 })
  }
  const { data: metric, error: metricError } = await supabaseAdmin.from('kpi_satisfaction_metrics')
    .select('code, name, target, is_active')
    .eq('code', campaign.kpi_metric_code).maybeSingle()
  if (metricError || !metric) {
    return NextResponse.json({ error: metricError?.message ?? 'ไม่พบชุด KPI ของรอบนี้' }, { status: 404 })
  }
  const { data: priorPublication, error: publicationError } = await supabaseAdmin.from('survey_kpi_publications').select('id').eq('campaign_id', campaignId).maybeSingle()
  if (publicationError) return NextResponse.json({ error: 'ตรวจสอบประวัติการเผยแพร่ KPI ไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
  if (priorPublication) return NextResponse.json({ error: 'รอบนี้เผยแพร่ KPI แล้ว' }, { status: 409 })
  const { data: collision, error: collisionError } = await supabaseAdmin.from('kpi_satisfaction').select('id, metric_code, fiscal_year')
    .eq('metric_code', campaign.kpi_metric_code).eq('fiscal_year', campaign.fiscal_year).not('value', 'is', null).maybeSingle()
  if (collisionError) return NextResponse.json({ error: 'ตรวจสอบข้อมูล KPI เดิมไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
  if (collision) return NextResponse.json({ error: 'มี KPI รหัสและปีงบประมาณนี้อยู่แล้ว ระบบจะไม่เขียนทับข้อมูลเดิม' }, { status: 409 })
  const result = await getSurveyDashboardData({ campaignId, grouping: 'month' })
  if (result.data.overall.normalizedPct === null) return NextResponse.json({ error: 'ไม่มีคำตอบคะแนนสำหรับเผยแพร่' }, { status: 422 })
  const formula = 'sum(score) / sum(max score for each answered scored question) * 100'
  const { error } = await supabaseAdmin.rpc('publish_survey_kpi', {
    p_campaign_id: campaignId,
    p_fiscal_year: campaign.fiscal_year,
    p_metric_code: campaign.kpi_metric_code,
    p_metric_name: metric.name,
    p_normalized_pct: result.data.overall.normalizedPct,
    p_positive_pct: result.data.overall.positivePct,
    p_response_count: result.data.responseCount,
    p_formula: formula,
    p_actor_id: actor.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  void supabaseAdmin.from('audit_log').insert({ action: 'satisfaction.kpi.publish', user_id: actor.id, target: campaignId, detail: JSON.stringify({ fiscalYear: campaign.fiscal_year, metricCode: campaign.kpi_metric_code, metricName: metric.name, target: Number(metric.target), normalizedPct: result.data.overall.normalizedPct, responseCount: result.data.responseCount, formula }) })
  return NextResponse.json({
    ok: true,
    fiscalYear: campaign.fiscal_year,
    metricCode: campaign.kpi_metric_code,
    metricName: metric.name,
    target: Number(metric.target),
  })
}
