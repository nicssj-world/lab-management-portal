import { NextRequest, NextResponse } from 'next/server'
import { visitorSubmissionSchema } from '@/lib/validations/it-visitor'
import { validateVisitorSubmission } from '@/lib/it-visitor/validation'
import {
  existingVisitorSubmission,
  getPublicVisitorFormState,
  insertVisitorLog,
  selfCheckoutVisitor,
  verifyVisitorChallenge,
} from '@/lib/it-visitor/public-server'
import type { VisitorSubmissionInput } from '@/lib/it-visitor/types'
import { consumeRateLimit, type RateLimitResult } from '@/lib/security/rate-limit'
import { getClientIp, privateRequestKey } from '@/lib/security/request-protection'

// ⚠️ Route สาธารณะโดยเจตนา — ไม่มี requireVisitorLog / requireIt / getItActor
// การอนุญาตมาจาก: ครอบครอง token 256 บิต + challenge ที่เซ็นแล้ว + rate limit
const MAX_BODY_BYTES = 32 * 1024
type Context = { params: Promise<{ token: string }> }

function successfulCheckInResponse(result: {
  logId: string
  activeVisit: import('@/lib/it-visitor/types').ActiveVisitorDTO
  checkoutSecret?: string
}, idempotent = false) {
  const response = NextResponse.json({
    ok: true,
    logId: result.logId,
    activeVisit: result.activeVisit,
    ...(idempotent ? { idempotent: true } : {}),
  })
  if (result.checkoutSecret) {
    response.cookies.set('lab_visitor_checkout', result.checkoutSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
      priority: 'high',
    })
  }
  return response
}

function tooManyRequests(limit: RateLimitResult) {
  return NextResponse.json(
    { error: 'มีคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่', code: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds), 'Cache-Control': 'no-store' } },
  )
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    const originUrl = new URL(origin)
    const requestUrl = new URL(request.url)
    const expectedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? requestUrl.host
    const expectedProtocol = request.headers.get('x-forwarded-proto') ?? requestUrl.protocol.replace(':', '')
    return originUrl.host === expectedHost && originUrl.protocol === `${expectedProtocol}:`
  } catch {
    return false
  }
}

function expireCheckoutCookie(response: NextResponse) {
  response.cookies.set('lab_visitor_checkout', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
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
  if (existing) return successfulCheckInResponse(existing, true)

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
    const result = await insertVisitorLog(validation.row, parsed.data.submissionKey)
    return successfulCheckInResponse(result)
  } catch (error) {
    const code = (error as { code?: string } | null)?.code
    if (code === '23505') {
      // ชนกับ submission_key ที่เพิ่งถูก insert โดย request คู่แข่ง — ถือว่าสำเร็จ
      const raced = await existingVisitorSubmission(parsed.data.submissionKey)
      if (raced) return successfulCheckInResponse(raced, true)
      return NextResponse.json({ error: 'ข้อมูลซ้ำ', code: 'duplicate' }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'
    return NextResponse.json({ error: message, code: 'submit_failed' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'คำขอมาจากแหล่งที่ไม่อนุญาต' }, { status: 403 })
  }

  const { token } = await params
  const limits = [
    consumeRateLimit({
      key: `visitor-checkout-ip:${privateRequestKey('visitor-checkout-ip', getClientIp(request.headers))}`,
      limit: 30,
      windowMs: 10 * 60 * 1000,
    }),
    consumeRateLimit({
      key: `visitor-checkout-form:${privateRequestKey('visitor-checkout-form', token)}`,
      limit: 600,
      windowMs: 10 * 60 * 1000,
    }),
  ]
  const rejectedLimit = limits.find((limit) => !limit.allowed)
  if (rejectedLimit) return tooManyRequests(rejectedLimit)

  const state = await getPublicVisitorFormState(token)
  if (!state) return NextResponse.json({ error: 'ไม่พบแบบฟอร์ม' }, { status: 404 })

  const checkoutSecret = request.cookies.get('lab_visitor_checkout')?.value
  if (!checkoutSecret) {
    return NextResponse.json({ error: 'ไม่พบสิทธิ์บันทึกออก กรุณาติดต่อเจ้าหน้าที่' }, { status: 401 })
  }

  try {
    const result = await selfCheckoutVisitor(checkoutSecret)
    if (result.status === 'invalid') {
      return expireCheckoutCookie(
        NextResponse.json({ error: 'สิทธิ์บันทึกออกไม่ถูกต้องหรือหมดอายุ' }, { status: 401 }),
      )
    }
    if (result.status === 'already_closed') {
      return expireCheckoutCookie(
        NextResponse.json({ error: 'รายการนี้บันทึกเวลาออกแล้ว' }, { status: 409 }),
      )
    }
    return expireCheckoutCookie(NextResponse.json({ ok: true, exitedAt: result.exitedAt }))
  } catch {
    return NextResponse.json({ error: 'บันทึกเวลาออกไม่สำเร็จ กรุณาติดต่อเจ้าหน้าที่' }, { status: 500 })
  }
}
