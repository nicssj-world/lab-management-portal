import 'server-only'

import { createHmac, randomBytes } from 'node:crypto'
import { requiredEnv } from '@/lib/env'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { campaignAvailability, type CampaignAvailability } from './campaign'
import { loadSurveyDefinition } from './server'
import type { NormalizedSurveyAnswer, SurveyCampaign, SurveyVersionDefinition } from './types'

export const DEVICE_COOKIE_NAME = 'lab_satisfaction_device'

export type PublicSurveyState = {
  availability: CampaignAvailability
  campaign: { id: string; name: string; onePerDevice: boolean; closesAt: string | null }
  definition: SurveyVersionDefinition | null
}

export function createDeviceToken() {
  return randomBytes(32).toString('base64url')
}

export function deviceHash(campaignId: string, deviceToken: string) {
  return createHmac('sha256', requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))
    .update(`${campaignId}:${deviceToken}`)
    .digest('hex')
}

export async function getPublicSurveyState(token: string, deviceToken?: string | null): Promise<PublicSurveyState | null> {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null
  const { data, error } = await supabaseAdmin.from('survey_campaigns').select('*').eq('public_token', token).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const campaign: SurveyCampaign = {
    id: data.id,
    surveyId: data.survey_id,
    surveyVersionId: data.survey_version_id,
    name: data.name,
    publicToken: data.public_token,
    status: data.status,
    opensAt: data.opens_at,
    closesAt: data.closes_at,
    responseLimit: data.response_limit,
    responseCount: data.response_count,
    onePerDevice: data.one_per_device,
  }
  let duplicate = false
  if (campaign.onePerDevice && deviceToken) {
    const { count, error: duplicateError } = await supabaseAdmin
      .from('survey_response_devices').select('*', { head: true, count: 'exact' })
      .eq('campaign_id', campaign.id).eq('device_hash', deviceHash(campaign.id, deviceToken))
    if (duplicateError) throw new Error(duplicateError.message)
    duplicate = (count ?? 0) > 0
  }
  const availability = campaignAvailability(campaign, new Date(), campaign.responseCount ?? 0, duplicate)
  const definition = await loadSurveyDefinition(campaign.surveyVersionId)
  if (!definition || definition.status !== 'published') {
    return { availability: { available: false, code: 'closed' }, campaign: { id: campaign.id, name: campaign.name, onePerDevice: campaign.onePerDevice, closesAt: campaign.closesAt }, definition: null }
  }
  return {
    availability,
    campaign: { id: campaign.id, name: campaign.name, onePerDevice: campaign.onePerDevice, closesAt: campaign.closesAt },
    definition,
  }
}

export async function existingSubmission(campaignId: string, submissionKey: string) {
  const { data, error } = await supabaseAdmin.from('survey_responses').select('id').eq('campaign_id', campaignId).eq('submission_key', submissionKey).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.id ?? null
}

export async function submitPublicSurvey(input: {
  token: string
  submissionKey: string
  deviceHash: string | null
  answers: NormalizedSurveyAnswer[]
}) {
  const { data, error } = await supabaseAdmin.rpc('submit_survey_response', {
    p_campaign_token: input.token,
    p_submission_key: input.submissionKey,
    p_device_hash: input.deviceHash,
    p_answers: input.answers,
  })
  if (error) throw new Error(error.message)
  return data as string
}
