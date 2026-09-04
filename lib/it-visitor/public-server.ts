import 'server-only'

import { randomBytes } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createPublicChallenge, verifyPublicChallenge } from '@/lib/security/public-challenge'
import { createCheckoutSecret, hashCheckoutSecret } from './checkout'
import { runVisitorAutoCheckout } from './auto-checkout-server'
import {
  DEFAULT_VISITOR_FORM_CONFIG,
  normalizeVisitorFormConfig,
} from './form-config'
import type { VisitorFormConfig } from './form-config'
import { resolveVisitorDestination } from '@/lib/lab-map/visitor'
import type {
  ActiveVisitorDTO,
  NormalizedVisitorLog,
  PublicVisitorFormState,
  VisitorCheckInResult,
} from './types'

/** purpose ของ challenge ระบบนี้ — คนละค่ากับแบบสำรวจ จึง replay ข้ามกันไม่ได้ */
const VISITOR_CHALLENGE_PURPOSE = 'visitor-challenge'

export function createVisitorChallenge(token: string, now = Date.now()) {
  return createPublicChallenge(VISITOR_CHALLENGE_PURPOSE, token, now)
}

export function verifyVisitorChallenge(token: string, challenge: string, now = Date.now()) {
  return verifyPublicChallenge(VISITOR_CHALLENGE_PURPOSE, token, challenge, now)
}

export function createVisitorToken() {
  return randomBytes(32).toString('base64url')
}

function isMissingFormConfigColumn(error: { code?: string; message?: string } | null) {
  return Boolean(error && (
    error.code === '42703'
    || /form_config/i.test(error.message ?? '')
  ))
}

/**
 * สถานะฟอร์มสาธารณะ — คืน DTO แคบที่สุด ไม่คืน public_token กลับไปหาเบราว์เซอร์
 * คืน null = ไม่พบ (token ผิด) ซึ่ง caller แปลงเป็น 404
 */
export async function getPublicVisitorFormState(token: string): Promise<PublicVisitorFormState | null> {
  // กัน token รูปแบบเพี้ยนตั้งแต่ก่อนแตะ DB
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null

  const { data, error } = await supabaseAdmin
    .from('it_visitor_form_settings')
    .select('is_open, form_config')
    .eq('public_token', token)
    .maybeSingle()
  if (error && !isMissingFormConfigColumn(error)) throw new Error(error.message)

  if (error && isMissingFormConfigColumn(error)) {
    const legacy = await supabaseAdmin
      .from('it_visitor_form_settings')
      .select('is_open')
      .eq('public_token', token)
      .maybeSingle()
    if (legacy.error) throw new Error(legacy.error.message)
    if (!legacy.data) return null
    return legacy.data.is_open
      ? { available: true, formConfig: { ...DEFAULT_VISITOR_FORM_CONFIG } }
      : { available: false, reason: 'closed', formConfig: { ...DEFAULT_VISITOR_FORM_CONFIG } }
  }

  if (!data) return null
  const formConfig = normalizeVisitorFormConfig((data as { form_config?: unknown }).form_config)

  return data.is_open
    ? { available: true, formConfig }
    : { available: false, reason: 'closed', formConfig }
}

/** idempotency — กดส่งซ้ำ/เน็ตหลุดแล้วยิงใหม่ ต้องได้บันทึกเดิม ไม่ใช่แถวใหม่ */
export interface ExistingVisitorSubmission {
  logId: string
  activeVisit: ActiveVisitorDTO
}

function toActiveVisitorDTO(row: { entered_at: string; contact_dept: string }): ActiveVisitorDTO {
  const destination = resolveVisitorDestination(row.contact_dept)
  return {
    enteredAt: row.entered_at,
    contactDept: row.contact_dept,
    checkpointCode: destination?.checkpointCode ?? null,
    checkpointNameTh: destination?.checkpointNameTh ?? null,
    routeCode: destination?.routeCode ?? null,
    directionsTh: destination?.directionsTh ?? [],
    safetyStationCode: destination?.safetyStationCode ?? 'office',
  }
}

export async function existingVisitorSubmission(submissionKey: string): Promise<ExistingVisitorSubmission | null> {
  await runVisitorAutoCheckout()
  const { data, error } = await supabaseAdmin
    .from('it_visitor_logs')
    .select('id, entered_at, contact_dept')
    .eq('submission_key', submissionKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    logId: data.id as string,
    activeVisit: toActiveVisitorDTO(data as { entered_at: string; contact_dept: string }),
  }
}

export async function insertVisitorLog(
  row: NormalizedVisitorLog,
  submissionKey: string,
): Promise<VisitorCheckInResult> {
  await runVisitorAutoCheckout()
  const checkoutSecret = createCheckoutSecret()
  const { data, error } = await supabaseAdmin
    .from('it_visitor_logs')
    .insert({
      ...row,
      submission_key: submissionKey,
      checkout_secret_hash: hashCheckoutSecret(checkoutSecret),
    })
    .select('id, entered_at, contact_dept')
    .single()
  if (error) throw error
  return {
    logId: data.id as string,
    checkoutSecret,
    activeVisit: toActiveVisitorDTO(data as { entered_at: string; contact_dept: string }),
  }
}

export async function getActiveVisitorBySecret(secret: string): Promise<ActiveVisitorDTO | null> {
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(secret)) return null

  await runVisitorAutoCheckout()
  const { data, error } = await supabaseAdmin
    .from('it_visitor_logs')
    .select('entered_at, exited_at, contact_dept')
    .eq('checkout_secret_hash', hashCheckoutSecret(secret))
    .is('exited_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return toActiveVisitorDTO(data as { entered_at: string; contact_dept: string })
}

export type SelfCheckoutResult =
  | { status: 'checked_out'; exitedAt: string }
  | { status: 'already_closed' }
  | { status: 'invalid' }

export async function selfCheckoutVisitor(secret: string): Promise<SelfCheckoutResult> {
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(secret)) return { status: 'invalid' }

  await runVisitorAutoCheckout()
  const secretHash = hashCheckoutSecret(secret)
  const { data: current, error: lookupError } = await supabaseAdmin
    .from('it_visitor_logs')
    .select('id, exited_at')
    .eq('checkout_secret_hash', secretHash)
    .maybeSingle()
  if (lookupError) throw new Error(lookupError.message)
  if (!current) return { status: 'invalid' }
  if (current.exited_at) return { status: 'already_closed' }

  const exitedAt = new Date().toISOString()
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('it_visitor_logs')
    .update({
      exited_at: exitedAt,
      closed_at: exitedAt,
      checkout_method: 'self',
      checkout_note: null,
      checkout_secret_hash: null,
    })
    .eq('id', current.id)
    .is('exited_at', null)
    .select('id')
    .maybeSingle()
  if (updateError) throw new Error(updateError.message)
  if (!updated) return { status: 'already_closed' }

  await supabaseAdmin.from('audit_log').insert({
    action: 'it_visitor.self_checkout',
    user_id: null,
    target: current.id,
    detail: 'ผู้มาติดต่อบันทึกเวลาออกจากลิงก์เดิม',
  })

  return { status: 'checked_out', exitedAt }
}

// ── ฝั่งเจ้าหน้าที่ ──

export async function getVisitorFormSettings() {
  const { data, error } = await supabaseAdmin
    .from('it_visitor_form_settings')
    .select('public_token, is_open, form_config, updated_at')
    .maybeSingle()
  if (error && !isMissingFormConfigColumn(error)) throw new Error(error.message)

  if (error && isMissingFormConfigColumn(error)) {
    const legacy = await supabaseAdmin
      .from('it_visitor_form_settings')
      .select('public_token, is_open, updated_at')
      .maybeSingle()
    if (legacy.error) throw new Error(legacy.error.message)
    if (!legacy.data) return null
    return {
      ...(legacy.data as { public_token: string; is_open: boolean; updated_at: string }),
      form_config: { ...DEFAULT_VISITOR_FORM_CONFIG },
    }
  }

  if (!data) return null
  return {
    public_token: data.public_token as string,
    is_open: data.is_open as boolean,
    updated_at: data.updated_at as string,
    form_config: normalizeVisitorFormConfig((data as { form_config?: unknown }).form_config),
  }
}

export async function setVisitorFormOpen(isOpen: boolean, actorId: string) {
  const { error } = await supabaseAdmin
    .from('it_visitor_form_settings')
    .update({ is_open: isOpen, updated_at: new Date().toISOString(), updated_by: actorId })
    .eq('singleton', true)
  if (error) throw new Error(error.message)
}

export async function setVisitorFormConfig(config: VisitorFormConfig, actorId: string) {
  const { error } = await supabaseAdmin
    .from('it_visitor_form_settings')
    .update({
      form_config: normalizeVisitorFormConfig(config),
      updated_at: new Date().toISOString(),
      updated_by: actorId,
    })
    .eq('singleton', true)
  if (error) throw new Error(error.message)
}

/** เปลี่ยน token — QR ที่พิมพ์แจกไปแล้วจะใช้ไม่ได้ทันที */
export async function rotateVisitorToken(actorId: string): Promise<string> {
  const nextToken = createVisitorToken()
  const { data, error } = await supabaseAdmin
    .from('it_visitor_form_settings')
    .update({ public_token: nextToken, updated_at: new Date().toISOString(), updated_by: actorId })
    .eq('singleton', true)
    .select('public_token')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('ยังไม่ได้ตั้งค่าฟอร์ม — กรุณารัน scripts/it-visitor-log.sql')
  return data.public_token as string
}
