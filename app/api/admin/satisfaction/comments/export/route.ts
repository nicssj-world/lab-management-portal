import { NextResponse } from 'next/server'
import { requireResource } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const access = await requireResource('แบบสำรวจความพึงพอใจ', 'view')
  if (access.response) return access.response
  const actor = access.actor
  if (!(actor.role === 'Admin' || actor.role === 'Manager')) {
    return NextResponse.json({ error: 'เฉพาะ Admin หรือ Manager เท่านั้น' }, { status: 403 })
  }
  const campaignId = new URL(request.url).searchParams.get('campaignId')
  if (!campaignId) return NextResponse.json({ error: 'กรุณาเลือกรอบเก็บข้อมูล' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('survey_answers')
    .select('id, text_value, created_at, comment_read_at, survey_questions(prompt), survey_campaigns(name)')
    .eq('campaign_id', campaignId).eq('is_comment', true).not('text_value', 'is', null).order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  void supabaseAdmin.from('audit_log').insert({ action: 'satisfaction.comments.export', user_id: actor.id, target: campaignId, detail: JSON.stringify({ count: data?.length ?? 0 }) })
  return NextResponse.json({ comments: data ?? [] })
}
