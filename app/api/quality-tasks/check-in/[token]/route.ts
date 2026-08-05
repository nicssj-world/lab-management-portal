import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getActor } from '@/lib/auth/guards'
import { getCheckInContext, recordGuestCheckIn } from '@/lib/quality-tasks/check-in'
import { createPublicChallenge, verifyPublicChallenge } from '@/lib/security/public-challenge'
import { consumeRateLimit } from '@/lib/security/rate-limit'
import { getClientIp, privateRequestKey } from '@/lib/security/request-protection'

// ⚠️ Route สาธารณะโดยเจตนา — คนที่ไม่มีบัญชีในระบบต้องเข้าถึงหน้าเช็คอินได้
// ผู้ที่ล็อกอินอยู่แล้วยังคงเช็คอินผ่าน POST /api/admin/quality-tasks/check-in/[token] เดิม
// (ตรวจสิทธิ์ด้วย getActor() ในตัวเอง ไม่ผูกกับ proxy.ts อยู่แล้ว) route นี้รับเฉพาะ guest submission
const CHALLENGE_PURPOSE = 'quality-task-checkin-challenge'
const MAX_BODY_BYTES = 8 * 1024

type Params = { params: Promise<{ token: string }> }

const guestSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  department: z.string().trim().min(1).max(150),
  challenge: z.string().min(1).max(500),
  website: z.string().max(200).optional().default(''),
})

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'มีคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่', code: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds), 'Cache-Control': 'no-store' } },
  )
}

export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params
  const ipLimit = consumeRateLimit({
    key: `qt-checkin-get:${privateRequestKey('qt-checkin-get-ip', getClientIp(request.headers))}`,
    limit: 120,
    windowMs: 10 * 60 * 1000,
  })
  if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfterSeconds)

  const actor = await getActor()
  const context = await getCheckInContext(token, actor?.id ?? null)
  if (!context) return NextResponse.json({ error: 'ไม่พบ QR สำหรับการประชุมนี้' }, { status: 404 })

  return NextResponse.json({
    context,
    loggedIn: Boolean(actor),
    actorName: actor?.name ?? null,
    // ผู้ที่ล็อกอินอยู่แล้วไม่ต้องใช้ guest form เลย ไม่ต้องออก challenge ให้
    challenge: actor ? null : createPublicChallenge(CHALLENGE_PURPOSE, token),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: Params) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: 'ข้อมูลมีขนาดเกิน 8 KiB' }, { status: 413 })
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'ข้อมูลมีขนาดเกิน 8 KiB' }, { status: 413 })
  }
  let body: unknown
  try { body = JSON.parse(raw) } catch { body = null }
  const parsed = guestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' }, { status: 422 })

  const { token } = await params

  // honeypot — ตอบ 429 ไม่ใช่ 400/422 เพื่อไม่บอกบอทว่าติดกับดักช่องไหน
  if (parsed.data.website.trim()) {
    return NextResponse.json({ error: 'ไม่สามารถส่งข้อมูลได้', code: 'rejected' }, { status: 429 })
  }

  const challenge = verifyPublicChallenge(CHALLENGE_PURPOSE, token, parsed.data.challenge)
  if (!challenge) {
    return NextResponse.json(
      { error: 'แบบฟอร์มหมดอายุ กรุณาสแกน QR Code หรือเปิดหน้าใหม่', code: 'challenge_invalid' },
      { status: 429 },
    )
  }

  const windowMs = 10 * 60 * 1000
  const limits = [
    consumeRateLimit({
      key: `qt-checkin-submit-visitor:${privateRequestKey('qt-checkin-visitor', challenge.visitorId)}`,
      limit: 6,
      windowMs,
    }),
    consumeRateLimit({
      key: `qt-checkin-submit-ip:${privateRequestKey('qt-checkin-submit-ip', getClientIp(request.headers))}`,
      limit: 60,
      windowMs,
    }),
    consumeRateLimit({
      key: `qt-checkin-submit-form:${privateRequestKey('qt-checkin-form', token)}`,
      limit: 600,
      windowMs,
    }),
  ]
  const rejectedLimit = limits.find((limit) => !limit.allowed)
  if (rejectedLimit) return tooManyRequests(rejectedLimit.retryAfterSeconds)

  try {
    const result = await recordGuestCheckIn(token, {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      department: parsed.data.department,
    })
    if (result.status === 'not_found') return NextResponse.json({ error: 'ไม่พบ QR สำหรับการประชุมนี้' }, { status: 404 })
    if (result.status === 'closed') return NextResponse.json({ error: 'การประชุมนี้ปิดงานแล้ว ไม่รับเช็คอินเพิ่ม' }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'เช็คอินไม่สำเร็จ' }, { status: 500 })
  }
}
