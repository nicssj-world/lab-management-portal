import 'server-only'

import { randomBytes } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createPublicChallenge, verifyPublicChallenge } from '@/lib/security/public-challenge'
import type {
  HeadContactFormSettings,
  HeadContactServiceUnit,
  NormalizedHeadContactSubmission,
  PublicHeadContactFormState,
} from './types'

const HEAD_CONTACT_CHALLENGE_PURPOSE = 'head-contact-challenge'

export function createHeadContactChallenge(token: string, now = Date.now()) {
  return createPublicChallenge(HEAD_CONTACT_CHALLENGE_PURPOSE, token, now)
}

export function verifyHeadContactChallenge(token: string, challenge: string, now = Date.now()) {
  return verifyPublicChallenge(HEAD_CONTACT_CHALLENGE_PURPOSE, token, challenge, now)
}

export function createHeadContactToken() {
  return randomBytes(32).toString('base64url')
}

export async function getPublicHeadContactFormState(token: string): Promise<PublicHeadContactFormState | null> {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('head_contact_form_settings')
    .select('is_open')
    .eq('public_token', token)
    .maybeSingle()
  if (settingsError) throw new Error(settingsError.message)
  if (!settings) return null

  const { data: units, error: unitsError } = await supabaseAdmin
    .from('head_contact_service_units')
    .select('id, name, display_order, is_active')
    .eq('is_active', true)
    .order('display_order')
    .order('name')
  if (unitsError) throw new Error(unitsError.message)
  const publicUnits = (units ?? []) as HeadContactServiceUnit[]
  return settings.is_open
    ? { available: true, units: publicUnits }
    : { available: false, reason: 'closed', units: publicUnits }
}

export async function getActiveHeadContactUnit(id: string): Promise<HeadContactServiceUnit | null> {
  const { data, error } = await supabaseAdmin
    .from('head_contact_service_units')
    .select('id, name, display_order, is_active')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as HeadContactServiceUnit | null) ?? null
}

export async function existingHeadContactSubmission(submissionKey: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('head_contact_submissions')
    .select('id')
    .eq('submission_key', submissionKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.id ?? null
}

export async function insertHeadContactSubmission(
  row: NormalizedHeadContactSubmission,
  submissionKey: string,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('head_contact_submissions')
    .insert({ ...row, submission_key: submissionKey })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function getHeadContactFormSettings(): Promise<HeadContactFormSettings | null> {
  const { data, error } = await supabaseAdmin
    .from('head_contact_form_settings')
    .select('public_token, is_open, updated_at')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as HeadContactFormSettings | null) ?? null
}

export async function setHeadContactFormOpen(isOpen: boolean, actorId: string) {
  const { error } = await supabaseAdmin
    .from('head_contact_form_settings')
    .update({ is_open: isOpen, updated_at: new Date().toISOString(), updated_by: actorId })
    .eq('singleton', true)
  if (error) throw new Error(error.message)
}

export async function rotateHeadContactToken(actorId: string) {
  const publicToken = createHeadContactToken()
  const { data, error } = await supabaseAdmin
    .from('head_contact_form_settings')
    .update({ public_token: publicToken, updated_at: new Date().toISOString(), updated_by: actorId })
    .eq('singleton', true)
    .select('public_token')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('ยังไม่ได้ตั้งค่าฟอร์ม — กรุณารัน scripts/head-contact-module.sql')
  return data.public_token as string
}
