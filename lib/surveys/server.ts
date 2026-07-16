import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type {
  SatisfactionCampaignListItem,
  SatisfactionSurveyListItem,
} from '@/lib/supabase/types'
import type { SurveyQuestion, SurveyVersionDefinition } from './types'
import { cloneDefinition, validateDefinitionForPublish } from './definition'

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
    id: string
    version_number: number
    status: SatisfactionSurveyListItem['latestStatus']
    published_at: string | null
    updated_at: string
  }>
}

export async function listSurveys(): Promise<SatisfactionSurveyListItem[]> {
  const { data, error } = await supabaseAdmin
    .from('surveys')
    .select('id, code, title, description, archived_at, updated_at, survey_versions(id, version_number, status, published_at, updated_at)')
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
      latestVersionId: latest?.id ?? null,
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
  survey_version_id: string
  public_token: string
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
    .select('id, name, survey_id, survey_version_id, public_token, status, response_count, response_limit, opens_at, closes_at, updated_at, surveys(code, title), survey_versions(version_number)')
    .order('updated_at', { ascending: false })
  fail(error)

  return ((data ?? []) as unknown as CampaignRow[]).map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    surveyId: campaign.survey_id,
    surveyVersionId: campaign.survey_version_id,
    surveyCode: campaign.surveys?.code ?? '—',
    surveyTitle: campaign.surveys?.title ?? 'ไม่พบแบบสำรวจ',
    versionNumber: campaign.survey_versions?.version_number ?? 0,
    publicToken: campaign.public_token,
    status: campaign.status,
    responseCount: campaign.response_count,
    responseLimit: campaign.response_limit,
    opensAt: campaign.opens_at,
    closesAt: campaign.closes_at,
    updatedAt: campaign.updated_at,
  }))
}

type DefinitionRows = {
  version: Record<string, unknown>
  sections: Array<Record<string, unknown>>
  questions: Array<Record<string, unknown>>
  options: Array<Record<string, unknown>>
}

function hydrateDefinition(rows: DefinitionRows): SurveyVersionDefinition {
  const { version, sections, questions, options } = rows
  return {
    id: String(version.id),
    surveyId: String(version.survey_id),
    versionNumber: Number(version.version_number),
    title: String(version.title),
    description: version.description ? String(version.description) : null,
    status: version.status as SurveyVersionDefinition['status'],
    publishedAt: version.published_at ? String(version.published_at) : null,
    sections: sections
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
      .map((section) => ({
        id: String(section.id),
        sectionKey: String(section.section_key),
        title: String(section.title),
        description: section.description ? String(section.description) : null,
        sortOrder: Number(section.sort_order),
        questions: questions
          .filter((question) => question.survey_section_id === section.id)
          .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
          .map((question) => {
            const type = String(question.question_type) as SurveyQuestion['type']
            const base = {
              id: String(question.id),
              questionKey: String(question.question_key),
              sectionId: String(section.id),
              prompt: String(question.prompt),
              type,
              required: Boolean(question.required),
              sortOrder: Number(question.sort_order),
              helpText: question.help_text ? String(question.help_text) : null,
              isComment: Boolean(question.is_comment),
            }
            const questionOptions = options
              .filter((option) => option.survey_question_id === question.id)
              .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
              .map((option) => ({
                id: String(option.id),
                optionKey: String(option.option_key),
                label: String(option.label),
                value: String(option.value),
                score: option.score === null ? null : Number(option.score),
                allowsOtherText: Boolean(option.allows_other_text),
                sortOrder: Number(option.sort_order),
              }))
            if (type === 'single_choice') return { ...base, type, options: questionOptions }
            if (type === 'rating_scale') return {
              ...base,
              type,
              options: questionOptions,
              positiveThreshold: Number(question.positive_threshold ?? 4),
              allowDetailText: Boolean(question.allow_detail_text),
              detailLabel: question.detail_label ? String(question.detail_label) : null,
            }
            if (type === 'number') return {
              ...base,
              type,
              min: Number(question.numeric_min ?? 0),
              max: Number(question.numeric_max ?? 100),
              placeholder: question.placeholder ? String(question.placeholder) : null,
            }
            if (type === 'short_text' || type === 'long_text') return {
              ...base,
              type,
              maxLength: Number(question.text_max_length ?? (type === 'short_text' ? 500 : 4_000)),
              placeholder: question.placeholder ? String(question.placeholder) : null,
            }
            return { ...base, type: 'yes_no' as const, options: questionOptions }
          }),
      })),
  }
}

export async function loadSurveyDefinition(versionId: string): Promise<SurveyVersionDefinition | null> {
  const { data: version, error: versionError } = await supabaseAdmin
    .from('survey_versions').select('*').eq('id', versionId).maybeSingle()
  fail(versionError)
  if (!version) return null
  const [sectionResult, questionResult, optionResult] = await Promise.all([
    supabaseAdmin.from('survey_sections').select('*').eq('survey_version_id', versionId),
    supabaseAdmin.from('survey_questions').select('*').eq('survey_version_id', versionId),
    supabaseAdmin.from('survey_question_options').select('*').eq('survey_version_id', versionId),
  ])
  fail(sectionResult.error); fail(questionResult.error); fail(optionResult.error)
  return hydrateDefinition({
    version,
    sections: sectionResult.data ?? [],
    questions: questionResult.data ?? [],
    options: optionResult.data ?? [],
  })
}

export type SurveyWorkspace = {
  survey: { id: string; code: string; title: string; archivedAt: string | null }
  versions: Array<{ id: string; versionNumber: number; status: string; publishedAt: string | null }>
  definition: SurveyVersionDefinition
}

export async function getSurveyWorkspace(surveyId: string): Promise<SurveyWorkspace | null> {
  const [surveyResult, versionsResult] = await Promise.all([
    supabaseAdmin.from('surveys').select('id, code, title, archived_at').eq('id', surveyId).maybeSingle(),
    supabaseAdmin.from('survey_versions').select('id, version_number, status, published_at').eq('survey_id', surveyId).order('version_number', { ascending: false }),
  ])
  fail(surveyResult.error); fail(versionsResult.error)
  if (!surveyResult.data || !versionsResult.data?.length) return null
  const version = versionsResult.data.find((item) => item.status === 'draft') ?? versionsResult.data[0]
  const definition = await loadSurveyDefinition(version.id)
  if (!definition) return null
  return {
    survey: {
      id: surveyResult.data.id,
      code: surveyResult.data.code,
      title: surveyResult.data.title,
      archivedAt: surveyResult.data.archived_at,
    },
    versions: versionsResult.data.map((item) => ({
      id: item.id,
      versionNumber: item.version_number,
      status: item.status,
      publishedAt: item.published_at,
    })),
    definition,
  }
}

export async function createSurveyWithDraft(input: {
  code: string
  title: string
  description?: string | null
  actorId: string
}) {
  const surveyId = crypto.randomUUID()
  const versionId = crypto.randomUUID()
  const { error: surveyError } = await supabaseAdmin.from('surveys').insert({
    id: surveyId, code: input.code, title: input.title,
    description: input.description ?? null, created_by: input.actorId,
  })
  fail(surveyError)
  const { error: versionError } = await supabaseAdmin.from('survey_versions').insert({
    id: versionId, survey_id: surveyId, version_number: 1, status: 'draft',
    title: input.title, description: input.description ?? null, created_by: input.actorId,
  })
  if (versionError) {
    await supabaseAdmin.from('surveys').delete().eq('id', surveyId)
    fail(versionError)
  }
  return { surveyId, versionId }
}

export async function saveSurveyDraft(
  surveyId: string,
  definition: SurveyVersionDefinition,
  actorId: string,
) {
  const { error } = await supabaseAdmin.rpc('save_survey_draft', {
    p_survey_id: surveyId,
    p_definition: definition,
    p_actor_id: actorId,
  })
  fail(error)
}

export async function cloneSurveyDraft(surveyId: string, sourceVersionId: string, actorId: string) {
  const { data: versions, error } = await supabaseAdmin
    .from('survey_versions').select('id, version_number, status').eq('survey_id', surveyId)
  fail(error)
  if (versions?.some((version) => version.status === 'draft')) {
    throw new Error('แบบสำรวจนี้มีฉบับร่างอยู่แล้ว')
  }
  const source = await loadSurveyDefinition(sourceVersionId)
  if (!source || source.surveyId !== surveyId) throw new Error('ไม่พบเวอร์ชันต้นฉบับ')
  const nextVersion = Math.max(...(versions ?? []).map((version) => version.version_number), 0) + 1
  const draft = cloneDefinition(source, nextVersion)
  const { error: insertError } = await supabaseAdmin.from('survey_versions').insert({
    id: draft.id, survey_id: surveyId, version_number: nextVersion, status: 'draft',
    title: draft.title, description: draft.description ?? null, created_by: actorId,
  })
  fail(insertError)
  try {
    await saveSurveyDraft(surveyId, draft, actorId)
  } catch (saveError) {
    await supabaseAdmin.from('survey_versions').delete().eq('id', draft.id).eq('status', 'draft')
    throw saveError
  }
  return draft
}

export async function discardSurveyDraft(surveyId: string, versionId: string, actorId: string) {
  const { data, error } = await supabaseAdmin.rpc('discard_survey_draft', {
    p_survey_id: surveyId,
    p_version_id: versionId,
    p_actor_id: actorId,
  })
  fail(error)
  const result = (data as Array<{ action: 'archived' | 'restored'; restored_version_id: string | null }> | null)?.[0]
  if (!result || (result.action !== 'archived' && result.action !== 'restored')) {
    throw new Error('ไม่สามารถยกเลิกฉบับร่างได้')
  }
  return { action: result.action, restoredVersionId: result.restored_version_id }
}

export async function publishSurveyDraft(surveyId: string, versionId: string) {
  const definition = await loadSurveyDefinition(versionId)
  if (!definition || definition.surveyId !== surveyId || definition.status !== 'draft') {
    throw new Error('ไม่พบฉบับร่างที่ต้องการเผยแพร่')
  }
  const issues = validateDefinitionForPublish(definition)
  if (issues.length) return { ok: false as const, issues }
  const { error } = await supabaseAdmin.from('survey_versions').update({
    status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', versionId).eq('survey_id', surveyId).eq('status', 'draft')
  fail(error)
  return { ok: true as const }
}

export async function setSurveyArchived(surveyId: string, archived: boolean) {
  const { error } = await supabaseAdmin.from('surveys').update({
    archived_at: archived ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', surveyId)
  fail(error)
}
