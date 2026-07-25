import 'server-only'

import { randomBytes } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createPublicChallenge, verifyPublicChallenge } from '@/lib/security/public-challenge'
import type { NormalizedVisitorLog, PublicVisitorFormState } from './types'

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

/**
 * สถานะฟอร์มสาธารณะ — คืน DTO แคบที่สุด ไม่คืน public_token กลับไปหาเบราว์เซอร์
 * คืน null = ไม่พบ (token ผิด) ซึ่ง caller แปลงเป็น 404
 */
export async function getPublicVisitorFormState(token: string): Promise<PublicVisitorFormState | null> {
  // กัน token รูปแบบเพี้ยนตั้งแต่ก่อนแตะ DB
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null

  const { data, error } = await supabaseAdmin
    .from('it_visitor_form_settings')
    .select('is_open')
    .eq('public_token', token)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  return data.is_open ? { available: true } : { available: false, reason: 'closed' }
}

/** idempotency — กดส่งซ้ำ/เน็ตหลุดแล้วยิงใหม่ ต้องได้บันทึกเดิม ไม่ใช่แถวใหม่ */
export async function existingVisitorSubmission(submissionKey: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('it_visitor_logs')
    .select('id')
    .eq('submission_key', submissionKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.id ?? null
}

export async function insertVisitorLog(row: NormalizedVisitorLog, submissionKey: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('it_visitor_logs')
    .insert({ ...row, submission_key: submissionKey })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

// ── ฝั่งเจ้าหน้าที่ ──

export async function getVisitorFormSettings() {
  const { data, error } = await supabaseAdmin
    .from('it_visitor_form_settings')
    .select('public_token, is_open, updated_at')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as { public_token: string; is_open: boolean; updated_at: string } | null
}

export async function setVisitorFormOpen(isOpen: boolean, actorId: string) {
  const { error } = await supabaseAdmin
    .from('it_visitor_form_settings')
    .update({ is_open: isOpen, updated_at: new Date().toISOString(), updated_by: actorId })
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
