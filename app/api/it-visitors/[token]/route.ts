import { NextRequest, NextResponse } from 'next/server'
import { visitorSubmissionSchema } from '@/lib/validations/it-visitor'
import { validateVisitorSubmission } from '@/lib/it-visitor/validation'
import {
  existingVisitorSubmission,
  getPublicVisitorFormState,
  insertVisitorLog,
  verifyVisitorChallenge,
} from '@/lib/it-visitor/public-server'
import type { VisitorSubmissionInput } from '@/lib/it-visitor/types'
import { consumeRateLimit, type RateLimitResult } from '@/lib/security/rate-limit'
import { getClientIp, privateRequestKey } from '@/lib/security/request-protection'

// ⚠️ Route สาธารณะโดยเจตนา — ไม่มี requireVisitorLog / requireIt / getItActor
// การอนุญาตมาจาก: ครอบครอง token 256 บิต + challenge ที่เซ็นแล้ว + rate limit
const MAX_BODY_BYTES = 32 * 1024
type Context = { params: Promise<{ token: string }> }

function tooManyRequests(limit: RateLimitResult) {
  return NextResponse.json(
    { error: 'มีคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่', code: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds), 'Cache-Control': 'no-store' } },
  )
}

export async function GET(request: NextRequest, { params }: Context) {
  const { token } = await params
  const ipLimit = consumeRateLimit({
    key: `visitor-get:${privateRequestKey('visitor-get-ip', getClientIp(request.headers))}`,
    limit: 300,
    windowMs: 10 * 60 * 1000,
  })
  if (!ipLimit.allowed) return tooManyRequests(ipLimit)

  const state = await getPublicVisitorFormState(token)
  return state
    ? NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } })
    : NextResponse.json({ error: 'ไม่พบแบบฟอร์ม' }, { status: 404 })
}

export async function POST(request: NextRequest, { params }: Context) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'ข้อมูลมีขนาดเกิน 32 KiB' }, { status: 413 })
  }
  const raw = await request.text()
  // วัดไบต์จริงซ้ำ — content-length โกหกได้ หรืออาจไม่มีมาเลย
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'ข้อมูลมีขนาดเกิน 32 KiB' }, { status: 413 })
  }
  let body: unknown
  try { body = JSON.parse(raw) } catch { body = null }
  const parsed = visitorSubmissionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' }, { status: 400 })

  const { token } = await params

  // honeypot — ตอบ 429 ไม่ใช่ 400 เพื่อไม่บอกบอทว่าติดกับดักช่องไหน
  if (parsed.data.website.trim()) {
    return NextResponse.json({ error: 'ไม่สามารถส่งข้อมูลได้', code: 'rejected' }, { status: 429 })
  }

  const challenge = verifyVisitorChallenge(token, parsed.data.challenge)
  if (!challenge) {
    return NextResponse.json(
      { error: 'แบบฟอร์มหมดอายุ กรุณาสแกน QR Code หรือเปิดลิงก์ใหม่', code: 'challenge_invalid' },
      { status: 429 },
    )
  }

  const windowMs = 10 * 60 * 1000
  const limits = [
    // ต่อ challenge ที่ออกไป 1 ใบ — คือด่านที่แน่นที่สุด
    consumeRateLimit({
      key: `visitor-submit-visitor:${privateRequestKey('visitor-visitor', challenge.visitorId)}`,
      limit: 6,
      windowMs,
    }),
    // หลวมเพราะทั้งโรงพยาบาลอาจ NAT อยู่หลัง IP เดียว
    consumeRateLimit({
      key: `visitor-submit-ip:${privateRequestKey('visitor-submit-ip', getClientIp(request.headers))}`,
      limit: 120,
      windowMs,
    }),
    consumeRateLimit({
      key: `visitor-submit-form:${privateRequestKey('visitor-form', token)}`,
      limit: 1_200,
      windowMs,
    }),
  ]
  const rejectedLimit = limits.find((limit) => !limit.allowed)
  if (rejectedLimit) return tooManyRequests(rejectedLimit)

  const state = await getPublicVisitorFormState(token)
  if (!state) return NextResponse.json({ error: 'ไม่พบแบบฟอร์ม' }, { status: 404 })

  // เช็ค idempotency ก่อน gate เปิด/ปิด — ยิงซ้ำหลังฟอร์มเพิ่งถูกปิด
  // ต้องได้ id เดิมกลับไป ไม่ใช่ 409 ที่ทำให้ผู้ใช้คิดว่าบันทึกไม่สำเร็จ
  const existing = await existingVisitorSubmission(parsed.data.submissionKey)
  if (existing) return NextResponse.json({ ok: true, logId: existing, idempotent: true })

  if (!state.available) {
    return NextResponse.json(
      { error: 'ขณะนี้ปิดรับแบบฟอร์มชั่วคราว กรุณาติดต่อเจ้าหน้าที่', code: 'closed' },
      { status: 409 },
    )
  }

  const validation = validateVisitorSubmission(parsed.data.form as VisitorSubmissionInput)
  if (!validation.ok) {
    return NextResponse.json({ error: 'กรุณาตรวจสอบข้อมูล', issues: validation.issues }, { status: 422 })
  }

  try {
    const logId = await insertVisitorLog(validation.row, parsed.data.submissionKey)
    return NextResponse.json({ ok: true, logId })
  } catch (error) {
    const code = (error as { code?: string } | null)?.code
    if (code === '23505') {
      // ชนกับ submission_key ที่เพิ่งถูก insert โดย request คู่แข่ง — ถือว่าสำเร็จ
      const raced = await existingVisitorSubmission(parsed.data.submissionKey)
      if (raced) return NextResponse.json({ ok: true, logId: raced, idempotent: true })
      return NextResponse.json({ error: 'ข้อมูลซ้ำ', code: 'duplicate' }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'
    return NextResponse.json({ error: message, code: 'submit_failed' }, { status: 500 })
  }
}
