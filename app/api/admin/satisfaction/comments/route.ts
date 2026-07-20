import { NextResponse } from 'next/server'
import { requireSatisfaction } from '@/lib/surveys/guard'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const access = await requireSatisfaction('view')
  if (access.response) return access.response
  const params = new URL(request.url).searchParams
  const surveyId = params.get('surveyId')
  const campaignId = params.get('campaignId')
  const read = params.get('read')
  const search = params.get('search')?.trim()
  let query: any = supabaseAdmin.from('survey_answers')
    .select('id, campaign_id, survey_question_id, text_value, created_at, comment_read_at, survey_questions(prompt), survey_campaigns!inner(name, survey_id, surveys(code, title), survey_versions(version_number))')
    .eq('is_comment', true).not('text_value', 'is', null).order('created_at', { ascending: false }).limit(500)
  if (surveyId) query = query.eq('survey_campaigns.survey_id', surveyId)
  if (campaignId) query = query.eq('campaign_id', campaignId)
  if (read === 'read') query = query.not('comment_read_at', 'is', null)
  if (read === 'unread') query = query.is('comment_read_at', null)
  if (search) query = query.ilike('text_value', `%${search.replace(/[%_]/g, '')}%`)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data ?? [] })
}
