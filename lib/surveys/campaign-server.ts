import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { SatisfactionCampaignListItem } from '@/lib/supabase/types'
import { assertCampaignTransition, createPublicToken } from './campaign'

const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message) }

export async function createCampaign(input: {
  surveyId: string
  surveyVersionId: string
  name: string
  opensAt?: string | null
  closesAt?: string | null
  responseLimit?: number | null
  onePerDevice: boolean
  actorId: string
}) {
  const { data: version, error: versionError } = await supabaseAdmin
    .from('survey_versions').select('id, survey_id, status').eq('id', input.surveyVersionId).maybeSingle()
  fail(versionError)
  if (!version || version.survey_id !== input.surveyId || version.status !== 'published') {
    throw new Error('สร้างรอบได้เฉพาะเวอร์ชันที่เผยแพร่แล้ว')
  }
  if (input.opensAt && input.closesAt && new Date(input.opensAt) >= new Date(input.closesAt)) {
    throw new Error('วันปิดรับต้องอยู่หลังวันเปิดรับ')
  }
  const { data, error } = await supabaseAdmin.from('survey_campaigns').insert({
    survey_id: input.surveyId,
    survey_version_id: input.surveyVersionId,
    name: input.name,
    public_token: createPublicToken(),
    status: 'draft',
    opens_at: input.opensAt ?? null,
    closes_at: input.closesAt ?? null,
    response_limit: input.responseLimit ?? null,
    one_per_device: input.onePerDevice,
    created_by: input.actorId,
  }).select('id').single()
  fail(error)
  return { id: data!.id }
}

export async function updateCampaign(campaignId: string, patch: {
  name?: string
  status?: 'draft' | 'open' | 'closed'
  opensAt?: string | null
  closesAt?: string | null
  responseLimit?: number | null
  onePerDevice?: boolean
}) {
  const { data: current, error: currentError } = await supabaseAdmin
    .from('survey_campaigns').select('*').eq('id', campaignId).maybeSingle()
  fail(currentError)
  if (!current) throw new Error('ไม่พบรอบเก็บข้อมูล')
  if (patch.status) assertCampaignTransition(current.status, patch.status)
  if (current.status !== 'draft' && patch.onePerDevice !== undefined && patch.onePerDevice !== current.one_per_device) {
    throw new Error('เปลี่ยนนโยบายหนึ่งคำตอบต่ออุปกรณ์ได้เฉพาะฉบับร่าง')
  }
  const opensAt = patch.opensAt === undefined ? current.opens_at : patch.opensAt
  const closesAt = patch.closesAt === undefined ? current.closes_at : patch.closesAt
  if (opensAt && closesAt && new Date(opensAt) >= new Date(closesAt)) {
    throw new Error('วันปิดรับต้องอยู่หลังวันเปิดรับ')
  }
  const { error } = await supabaseAdmin.from('survey_campaigns').update({
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.opensAt !== undefined ? { opens_at: patch.opensAt } : {}),
    ...(patch.closesAt !== undefined ? { closes_at: patch.closesAt } : {}),
    ...(patch.responseLimit !== undefined ? { response_limit: patch.responseLimit } : {}),
    ...(patch.onePerDevice !== undefined ? { one_per_device: patch.onePerDevice } : {}),
    ...(patch.status === 'closed' ? { closed_at: new Date().toISOString() } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', campaignId)
  fail(error)
}

export async function deleteCampaign(campaignId: string) {
  const { data: current, error: currentError } = await supabaseAdmin
    .from('survey_campaigns').select('id').eq('id', campaignId).maybeSingle()
  fail(currentError)
  if (!current) throw new Error('ไม่พบรอบเก็บข้อมูล')

  const { count: responseCount, error: responseError } = await supabaseAdmin
    .from('survey_responses').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId)
  fail(responseError)
  if ((responseCount ?? 0) > 0) throw new Error('ลบไม่ได้ เพราะรอบนี้มีคำตอบแล้ว')

  const { count: kpiCount, error: kpiError } = await supabaseAdmin
    .from('survey_kpi_publications').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId)
  fail(kpiError)
  if ((kpiCount ?? 0) > 0) throw new Error('ลบไม่ได้ เพราะรอบนี้ถูกส่งขึ้น KPI แล้ว')

  const { error } = await supabaseAdmin.from('survey_campaigns').delete().eq('id', campaignId)
  fail(error)
}

export async function rotateCampaignToken(campaignId: string) {
  const { data, error } = await supabaseAdmin.from('survey_campaigns').update({
    public_token: createPublicToken(), updated_at: new Date().toISOString(),
  }).eq('id', campaignId).neq('status', 'closed').select('public_token').maybeSingle()
  fail(error)
  if (!data) throw new Error('ไม่สามารถเปลี่ยน token ของรอบที่ปิดแล้ว')
  return data.public_token as string
}

export type CampaignMutationResult = Pick<SatisfactionCampaignListItem, 'id'>
