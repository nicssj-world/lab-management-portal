import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import {
  analyzeRejectionData,
  getRejectionAnalysisSummary,
  saveReviewedReasonMappings,
} from '@/lib/rejection/analysis-server'
import { isRejectionReasonCategoryCode } from '@/lib/rejection/analysis'

type Actor = { id: string; role: string }

async function getActor(): Promise<Actor | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id,role').eq('id', user.id).single()
  return data as Actor | null
}

function parseYear(value: string | null, fallback: number): number {
  if (!value) return fallback
  const year = Number(value)
  if (!Number.isInteger(year)) throw new Error('ปีไม่ถูกต้อง')
  return year
}

function optionsFromSearchParams(searchParams: URLSearchParams) {
  const currentYear = new Date().getFullYear()
  const fromYear = parseYear(searchParams.get('from_year'), 2023)
  const toYear = parseYear(searchParams.get('to_year'), currentYear)
  const work = searchParams.get('work') || null
  return { fromYear, toYear, work }
}

function optionsFromBody(body: Record<string, unknown>) {
  const currentYear = new Date().getFullYear()
  const fromYear = body.from_year === undefined ? 2023 : parseYear(String(body.from_year), 2023)
  const toYear = body.to_year === undefined ? currentYear : parseYear(String(body.to_year), currentYear)
  const work = typeof body.work === 'string' && body.work.trim() ? body.work.trim() : null
  return { fromYear, toYear, work }
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'ไม่สามารถวิเคราะห์ข้อมูลได้'
  const migrationMissing = message.includes('reason_category')
    || message.includes('rejection_reason_mappings')
    || message.includes('schema cache')
  return NextResponse.json({
    error: migrationMissing
      ? 'ยังไม่ได้ติดตั้งโครงสร้างวิเคราะห์ Rejection กรุณารัน migration rejection_reason_analysis ก่อน'
      : message,
  }, { status: migrationMissing ? 503 : 500 })
}

export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const options = optionsFromSearchParams(req.nextUrl.searchParams)
    const data = await getRejectionAnalysisSummary(options)
    return NextResponse.json(data)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rawBody = await req.json().catch(() => ({}))
    const body = rawBody && typeof rawBody === 'object' ? rawBody as Record<string, unknown> : {}
    const data = await analyzeRejectionData(optionsFromBody(body))
    return NextResponse.json(data)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const perms = await getRolePermissions(actor.role)
  if (perms['ความเสี่ยง / Rejection'] !== 'edit') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json() as Record<string, unknown>
    const normalizedReasons = Array.isArray(body.normalized_reasons)
      ? body.normalized_reasons
        .filter((reason): reason is string => typeof reason === 'string')
        .map(reason => reason.trim().slice(0, 500))
        .filter(Boolean)
      : typeof body.normalized_reason === 'string'
        ? [body.normalized_reason.trim().slice(0, 500)]
        : []
    const categoryCode = body.category_code
    if (normalizedReasons.length === 0 || normalizedReasons.length > 200 || !isRejectionReasonCategoryCode(categoryCode)) {
      return NextResponse.json({ error: 'ข้อมูลการจัดหมวดหมู่ไม่ถูกต้อง' }, { status: 400 })
    }

    const result = await saveReviewedReasonMappings({
      normalizedReasons,
      categoryCode,
      actorId: actor.id,
    })
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
