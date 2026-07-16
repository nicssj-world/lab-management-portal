import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { aggregateSurveyResults, type AggregateResponseRow, type SurveyDashboardData } from './aggregates'
import { loadSurveyDefinition } from './server'

export async function getSurveyDashboardData(input: {
  campaignId: string
  from?: string | null
  to?: string | null
  grouping?: 'day' | 'month'
}): Promise<{ data: SurveyDashboardData; campaign: { id: string; name: string; surveyVersionId: string } }> {
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('survey_campaigns').select('id, name, survey_version_id').eq('id', input.campaignId).maybeSingle()
  if (campaignError) throw new Error(campaignError.message)
  if (!campaign) throw new Error('ไม่พบรอบเก็บข้อมูล')
  const definition = await loadSurveyDefinition(campaign.survey_version_id)
  if (!definition) throw new Error('ไม่พบเวอร์ชันแบบสำรวจ')

  let responseQuery = supabaseAdmin.from('survey_responses')
    .select('id, submitted_at').eq('campaign_id', input.campaignId).order('submitted_at')
  if (input.from) responseQuery = responseQuery.gte('submitted_at', input.from)
  if (input.to) responseQuery = responseQuery.lte('submitted_at', input.to)
  const { data: responses, error: responseError } = await responseQuery
  if (responseError) throw new Error(responseError.message)

  const responseIds = (responses ?? []).map((response) => response.id)
  const { data: answers, error: answerError } = responseIds.length
    ? await supabaseAdmin.from('survey_answers')
      .select('response_id, survey_question_id, survey_option_id, numeric_value, text_value, score')
      .in('response_id', responseIds)
    : { data: [], error: null }
  if (answerError) throw new Error(answerError.message)
  const byResponse = new Map<string, AggregateResponseRow['answers']>()
  for (const answer of answers ?? []) {
    const list = byResponse.get(answer.response_id) ?? []
    list.push({
      questionId: answer.survey_question_id,
      optionId: answer.survey_option_id,
      numericValue: answer.numeric_value === null ? null : Number(answer.numeric_value),
      textValue: answer.text_value,
      score: answer.score === null ? null : Number(answer.score),
    })
    byResponse.set(answer.response_id, list)
  }
  const rows: AggregateResponseRow[] = (responses ?? []).map((response) => ({
    responseId: response.id,
    submittedAt: response.submitted_at,
    answers: byResponse.get(response.id) ?? [],
  }))
  return {
    data: aggregateSurveyResults(definition, rows, input.grouping ?? 'day'),
    campaign: { id: campaign.id, name: campaign.name, surveyVersionId: campaign.survey_version_id },
  }
}
