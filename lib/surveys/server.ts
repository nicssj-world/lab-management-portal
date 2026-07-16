import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type {
  SatisfactionCampaignListItem,
  SatisfactionSurveyListItem,
} from '@/lib/supabase/types'

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

type SurveyRow = {
  id: string
  code: string
  title: string
  description: string | null
  archived_at: string | null
  updated_at: string
  survey_versions: Array<{
    version_number: number
    status: SatisfactionSurveyListItem['latestStatus']
    published_at: string | null
    updated_at: string
  }>
}

export async function listSurveys(): Promise<SatisfactionSurveyListItem[]> {
  const { data, error } = await supabaseAdmin
    .from('surveys')
    .select('id, code, title, description, archived_at, updated_at, survey_versions(version_number, status, published_at, updated_at)')
    .order('updated_at', { ascending: false })
  fail(error)

  return ((data ?? []) as SurveyRow[]).map((survey) => {
    const latest = [...(survey.survey_versions ?? [])].sort(
      (a, b) => b.version_number - a.version_number,
    )[0]
    return {
      id: survey.id,
      code: survey.code,
      title: survey.title,
      description: survey.description,
      archivedAt: survey.archived_at,
      latestVersion: latest?.version_number ?? null,
      latestStatus: latest?.status ?? null,
      publishedAt: latest?.published_at ?? null,
      updatedAt: latest?.updated_at ?? survey.updated_at,
    }
  })
}

type CampaignRow = {
  id: string
  name: string
  survey_id: string
  status: SatisfactionCampaignListItem['status']
  response_count: number
  response_limit: number | null
  opens_at: string | null
  closes_at: string | null
  updated_at: string
  surveys: { code: string; title: string } | null
  survey_versions: { version_number: number } | null
}

export async function listCampaigns(): Promise<SatisfactionCampaignListItem[]> {
  const { data, error } = await supabaseAdmin
    .from('survey_campaigns')
    .select('id, name, survey_id, status, response_count, response_limit, opens_at, closes_at, updated_at, surveys(code, title), survey_versions(version_number)')
    .order('updated_at', { ascending: false })
  fail(error)

  return ((data ?? []) as unknown as CampaignRow[]).map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    surveyId: campaign.survey_id,
    surveyCode: campaign.surveys?.code ?? '—',
    surveyTitle: campaign.surveys?.title ?? 'ไม่พบแบบสำรวจ',
    versionNumber: campaign.survey_versions?.version_number ?? 0,
    status: campaign.status,
    responseCount: campaign.response_count,
    responseLimit: campaign.response_limit,
    opensAt: campaign.opens_at,
    closesAt: campaign.closes_at,
    updatedAt: campaign.updated_at,
  }))
}
