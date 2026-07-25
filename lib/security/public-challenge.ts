import 'server-only'

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { requiredEnv } from '@/lib/env'

// Signed challenge สำหรับฟอร์มสาธารณะ (แบบสำรวจ, บันทึกการเข้า-ออก)
//
// เป็น token ที่พิสูจน์ตัวเองได้ในตัว ไม่ต้องเก็บ state ฝั่ง server:
// หน้าเพจสร้างตอน render → ฟอร์มแนบกลับมาตอน POST → route ตรวจลายเซ็น
//
// `purpose` ผูกลายเซ็นไว้กับระบบที่ออกมัน challenge ของแบบสำรวจจึงเอาไป
// replay กับบันทึกการเข้า-ออกไม่ได้ แม้จะเซ็นด้วยกุญแจเดียวกัน

/** มนุษย์เปิดฟอร์มแล้วกดส่งภายใน 750 ms ไม่ได้ — POST ที่เร็วกว่านี้คือสคริปต์ */
const CHALLENGE_MIN_AGE_MS = 750
/** เผื่อคนกรอกฟอร์มยาว ๆ ช้า ๆ แต่จำกัดหน้าต่าง replay */
const CHALLENGE_MAX_AGE_MS = 4 * 60 * 60 * 1000

type PublicChallengePayload = {
  v: 1
  tokenHash: string
  visitorId: string
  issuedAt: number
}

export type VerifiedPublicChallenge = {
  visitorId: string
  issuedAt: number
}

function challengeTokenHash(token: string) {
  return createHash('sha256').update(token).digest('base64url')
}

function signChallengePayload(purpose: string, encodedPayload: string) {
  return createHmac('sha256', requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))
    .update(`${purpose}:${encodedPayload}`)
    .digest('base64url')
}

export function createPublicChallenge(purpose: string, token: string, now = Date.now()) {
  const payload: PublicChallengePayload = {
    v: 1,
    tokenHash: challengeTokenHash(token),
    visitorId: randomBytes(18).toString('base64url'),
    issuedAt: now,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${signChallengePayload(purpose, encodedPayload)}`
}

export function verifyPublicChallenge(
  purpose: string,
  token: string,
  challenge: string,
  now = Date.now(),
): VerifiedPublicChallenge | null {
  const [encodedPayload, providedSignature, extra] = challenge.split('.')
  if (!encodedPayload || !providedSignature || extra) return null

  const expectedSignature = signChallengePayload(purpose, encodedPayload)
  const provided = Buffer.from(providedSignature)
  const expected = Buffer.from(expectedSignature)
  // timingSafeEqual โยน error เมื่อความยาวไม่เท่ากัน จึงต้องเช็คก่อน
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<PublicChallengePayload>
    if (payload.v !== 1 || payload.tokenHash !== challengeTokenHash(token)) return null
    if (typeof payload.visitorId !== 'string' || !/^[A-Za-z0-9_-]{24}$/.test(payload.visitorId)) return null
    if (typeof payload.issuedAt !== 'number' || !Number.isFinite(payload.issuedAt)) return null
    const age = now - payload.issuedAt
    if (age < CHALLENGE_MIN_AGE_MS || age > CHALLENGE_MAX_AGE_MS) return null
    return { visitorId: payload.visitorId, issuedAt: payload.issuedAt }
  } catch {
    return null
  }
}
