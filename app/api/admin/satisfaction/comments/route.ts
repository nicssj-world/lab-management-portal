import { NextResponse } from 'next/server'
import { requireResource } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const access = await requireResource('แบบสำรวจความพึงพอใจ', 'view')
  if (access.response) return access.response
  const params = new URL(request.url).searchParams
  const campaignId = params.get('campaignId')
  const read = params.get('read')
  const search = params.get('search')?.trim()
  let query: any = supabaseAdmin.from('survey_answers')
    .select('id, campaign_id, survey_question_id, text_value, created_at, comment_read_at, survey_questions(prompt), survey_campaigns(name)')
    .eq('is_comment', true).not('text_value', 'is', null).order('created_at', { ascending: false }).limit(500)
  if (campaignId) query = query.eq('campaign_id', campaignId)
  if (read === 'read') query = query.not('comment_read_at', 'is', null)
  if (read === 'unread') query = query.is('comment_read_at', null)
  if (search) query = query.ilike('text_value', `%${search.replace(/[%_]/g, '')}%`)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data ?? [] })
}
