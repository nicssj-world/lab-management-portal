import { NextResponse } from 'next/server'
import { z } from 'zod'
import { canAccessResource, requireResource } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getSurveyDashboardData } from '@/lib/surveys/dashboard-server'

const publishKpiSchema = z.object({
  fiscalYear: z.number().int().min(2500).max(3000),
  metricCode: z.string().trim().min(1).max(100),
  metricName: z.string().trim().min(1).max(500),
})
type Context = { params: Promise<{ campaignId: string }> }

export async function POST(request: Request, { params }: Context) {
  const access = await requireResource('แบบสำรวจความพึงพอใจ', 'edit')
  if (access.response) return access.response
  const actor = access.actor
  if (!(await canAccessResource(actor, 'KPI', 'edit'))) return NextResponse.json({ error: 'ต้องมีสิทธิ์แก้ไข KPI ด้วย' }, { status: 403 })
  const parsed = publishKpiSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูล KPI ไม่ถูกต้อง' }, { status: 400 })
  const { campaignId } = await params
  const { data: campaign, error: campaignError } = await supabaseAdmin.from('survey_campaigns').select('id, status, survey_version_id').eq('id', campaignId).maybeSingle()
  if (campaignError || !campaign) return NextResponse.json({ error: campaignError?.message ?? 'ไม่พบรอบเก็บข้อมูล' }, { status: 404 })
  if (campaign.status !== 'closed') return NextResponse.json({ error: 'ต้องปิดรอบเก็บข้อมูลก่อนเผยแพร่ KPI' }, { status: 409 })
  const { data: priorPublication } = await supabaseAdmin.from('survey_kpi_publications').select('id').eq('campaign_id', campaignId).maybeSingle()
  if (priorPublication) return NextResponse.json({ error: 'รอบนี้เผยแพร่ KPI แล้ว' }, { status: 409 })
  const { data: collision } = await supabaseAdmin.from('kpi_satisfaction').select('id, metric_code, fiscal_year').eq('metric_code', parsed.data.metricCode).eq('fiscal_year', parsed.data.fiscalYear).maybeSingle()
  if (collision) return NextResponse.json({ error: 'มี KPI รหัสและปีงบประมาณนี้อยู่แล้ว ระบบจะไม่เขียนทับข้อมูลเดิม' }, { status: 409 })
  const result = await getSurveyDashboardData({ campaignId, grouping: 'month' })
  if (result.data.overall.normalizedPct === null) return NextResponse.json({ error: 'ไม่มีคำตอบคะแนนสำหรับเผยแพร่' }, { status: 422 })
  const formula = 'sum(score) / sum(max score for each answered scored question) * 100'
  const { error } = await supabaseAdmin.rpc('publish_survey_kpi', {
    p_campaign_id: campaignId,
    p_fiscal_year: parsed.data.fiscalYear,
    p_metric_code: parsed.data.metricCode,
    p_metric_name: parsed.data.metricName,
    p_normalized_pct: result.data.overall.normalizedPct,
    p_positive_pct: result.data.overall.positivePct,
    p_response_count: result.data.responseCount,
    p_formula: formula,
    p_actor_id: actor.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  void supabaseAdmin.from('audit_log').insert({ action: 'satisfaction.kpi.publish', user_id: actor.id, target: campaignId, detail: JSON.stringify({ fiscalYear: parsed.data.fiscalYear, metricCode: parsed.data.metricCode, normalizedPct: result.data.overall.normalizedPct, responseCount: result.data.responseCount, formula }) })
  return NextResponse.json({ ok: true })
}
