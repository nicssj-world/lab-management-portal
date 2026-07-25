import { NextRequest, NextResponse } from 'next/server'
import { HeadContactPublicSubmissionSchema } from '@/lib/validations/head-contact'
import { validateHeadContactSubmission } from '@/lib/head-contact/validation'
import { OTHER_SERVICE_UNIT, headContactReference } from '@/lib/head-contact/constants'
import {
  existingHeadContactSubmission,
  getActiveHeadContactUnit,
  getPublicHeadContactFormState,
  insertHeadContactSubmission,
  verifyHeadContactChallenge,
} from '@/lib/head-contact/public-server'
import { consumeRateLimit, type RateLimitResult } from '@/lib/security/rate-limit'
import { getClientIp, privateRequestKey } from '@/lib/security/request-protection'
import type { HeadContactSubmissionInput } from '@/lib/head-contact/types'

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
  const limit = consumeRateLimit({
    key: `head-contact-get:${privateRequestKey('head-contact-get-ip', getClientIp(request.headers))}`,
    limit: 300,
    windowMs: 10 * 60 * 1000,
  })
  if (!limit.allowed) return tooManyRequests(limit)
  const state = await getPublicHeadContactFormState(token)
  return state
    ? NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } })
    : NextResponse.json({ error: 'ไม่พบแบบฟอร์ม' }, { status: 404 })
}

export async function POST(request: NextRequest, { params }: Context) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: 'ข้อมูลมีขนาดเกิน 32 KiB' }, { status: 413 })
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'ข้อมูลมีขนาดเกิน 32 KiB' }, { status: 413 })
  }
  let body: unknown
  try { body = JSON.parse(raw) } catch { body = null }
  const parsed = HeadContactPublicSubmissionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' }, { status: 400 })
  if (parsed.data.website.trim()) return NextResponse.json({ error: 'ไม่สามารถส่งข้อมูลได้' }, { status: 429 })

  const { token } = await params
  const challenge = verifyHeadContactChallenge(token, parsed.data.challenge)
  if (!challenge) {
    return NextResponse.json({ error: 'แบบฟอร์มหมดอายุ กรุณาเปิดลิงก์ใหม่', code: 'challenge_invalid' }, { status: 429 })
  }

  const limits = [
    consumeRateLimit({ key: `head-contact-submit-visitor:${privateRequestKey('head-contact-visitor', challenge.visitorId)}`, limit: 6, windowMs: 10 * 60 * 1000 }),
    consumeRateLimit({ key: `head-contact-submit-ip:${privateRequestKey('head-contact-submit-ip', getClientIp(request.headers))}`, limit: 120, windowMs: 10 * 60 * 1000 }),
    consumeRateLimit({ key: `head-contact-submit-form:${privateRequestKey('head-contact-form', token)}`, limit: 1_200, windowMs: 10 * 60 * 1000 }),
  ]
  const rejected = limits.find((limit) => !limit.allowed)
  if (rejected) return tooManyRequests(rejected)

  const state = await getPublicHeadContactFormState(token)
  if (!state) return NextResponse.json({ error: 'ไม่พบแบบฟอร์ม' }, { status: 404 })

  const existing = await existingHeadContactSubmission(parsed.data.submissionKey)
  if (existing) return NextResponse.json({ ok: true, reference: headContactReference(existing), idempotent: true })
  if (!state.available) return NextResponse.json({ error: 'ขณะนี้ปิดรับเรื่องชั่วคราว', code: 'closed' }, { status: 409 })

  const form: HeadContactSubmissionInput = { ...parsed.data.form }
  if (form.service_unit_id !== OTHER_SERVICE_UNIT) {
    const unit = await getActiveHeadContactUnit(form.service_unit_id)
    if (!unit) {
      return NextResponse.json({
        error: 'หน่วยรับบริการที่เลือกไม่พร้อมใช้งาน กรุณาเลือกใหม่',
        issues: [{ field: 'service_unit_id', message: 'กรุณาเลือกหน่วยรับบริการใหม่' }],
      }, { status: 422 })
    }
    form.service_unit_name = unit.name
  }
  const validation = validateHeadContactSubmission(form)
  if (!validation.ok) return NextResponse.json({ error: 'กรุณาตรวจสอบข้อมูล', issues: validation.issues }, { status: 422 })

  try {
    const id = await insertHeadContactSubmission(validation.row, parsed.data.submissionKey)
    return NextResponse.json({ ok: true, reference: headContactReference(id) })
  } catch (error) {
    if ((error as { code?: string } | null)?.code === '23505') {
      const raced = await existingHeadContactSubmission(parsed.data.submissionKey)
      if (raced) return NextResponse.json({ ok: true, reference: headContactReference(raced), idempotent: true })
    }
    return NextResponse.json({ error: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองอีกครั้ง', code: 'submit_failed' }, { status: 500 })
  }
}
