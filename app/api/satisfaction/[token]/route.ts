import { NextRequest, NextResponse } from 'next/server'
import { publicSubmissionSchema } from '@/lib/surveys/schemas'
import { validateSubmission } from '@/lib/surveys/validation'
import {
  createDeviceToken,
  DEVICE_COOKIE_NAME,
  deviceHash,
  existingSubmission,
  getPublicSurveyState,
  submitPublicSurvey,
} from '@/lib/surveys/public-server'
import type { SurveyAnswerInput } from '@/lib/surveys/types'

const MAX_BODY_BYTES = 64 * 1024
type Context = { params: Promise<{ token: string }> }

export async function GET(request: NextRequest, { params }: Context) {
  const { token } = await params
  const state = await getPublicSurveyState(token, request.cookies.get(DEVICE_COOKIE_NAME)?.value)
  return state
    ? NextResponse.json(state)
    : NextResponse.json({ error: 'ไม่พบแบบสำรวจ' }, { status: 404 })
}

export async function POST(request: NextRequest, { params }: Context) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'ข้อมูลคำตอบมีขนาดเกิน 64 KiB' }, { status: 413 })
  }
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > 64 * 1024) {
    return NextResponse.json({ error: 'ข้อมูลคำตอบมีขนาดเกิน 64 KiB' }, { status: 413 })
  }
  let body: unknown
  try { body = JSON.parse(raw) } catch { body = null }
  const parsed = publicSubmissionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลคำตอบไม่ถูกต้อง' }, { status: 400 })

  const { token } = await params
  const currentDeviceToken = request.cookies.get(DEVICE_COOKIE_NAME)?.value
  const state = await getPublicSurveyState(token, currentDeviceToken)
  if (!state || !state.definition) return NextResponse.json({ error: 'ไม่พบแบบสำรวจ' }, { status: 404 })

  const existing = await existingSubmission(state.campaign.id, parsed.data.submissionKey)
  if (existing) return NextResponse.json({ ok: true, responseId: existing, idempotent: true })
  if (!state.availability.available) {
    return NextResponse.json({ error: state.availability.code, code: state.availability.code }, { status: 409 })
  }

  const validation = validateSubmission(state.definition, parsed.data.answers as SurveyAnswerInput[])
  if (!validation.ok) {
    return NextResponse.json({ error: 'กรุณาตรวจสอบคำตอบ', issues: validation.issues }, { status: 422 })
  }

  const nextDeviceToken = currentDeviceToken ?? createDeviceToken()
  const campaignDeviceHash = state.campaign.onePerDevice
    ? deviceHash(state.campaign.id, nextDeviceToken)
    : null
  try {
    const responseId = await submitPublicSurvey({
      token,
      submissionKey: parsed.data.submissionKey,
      deviceHash: campaignDeviceHash,
      answers: validation.answers,
    })
    const response = NextResponse.json({ ok: true, responseId })
    if (state.campaign.onePerDevice && !currentDeviceToken) {
      response.cookies.set(DEVICE_COOKIE_NAME, nextDeviceToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    }
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ส่งคำตอบไม่สำเร็จ'
    const duplicate = /survey_response_devices|duplicate|unique/i.test(message)
    return NextResponse.json({ error: duplicate ? 'อุปกรณ์นี้ตอบแบบสำรวจแล้ว' : message, code: duplicate ? 'duplicate' : 'submit_failed' }, { status: duplicate ? 409 : 500 })
  }
}
