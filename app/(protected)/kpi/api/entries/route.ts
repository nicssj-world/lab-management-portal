import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireResource } from '@/lib/auth/guards'
import { getDashboard, upsertEntries } from '@/lib/queries/kpi'

export async function GET(request: NextRequest) {
  const guard = await requireResource('KPI', 'view')
  if (guard.response) return guard.response

  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? '0', 10)
  const month = parseInt(searchParams.get('month') ?? '0', 10)
  const dept = searchParams.get('dept') ?? undefined

  if (!year || !month) return NextResponse.json({ error: 'year and month are required' }, { status: 400 })

  const data = await getDashboard(supabase, year, month, dept)
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const guard = await requireResource('KPI', 'edit')
  if (guard.response) return guard.response

  const supabase = await createClient()

  const { entries } = await request.json()
  if (!Array.isArray(entries)) return NextResponse.json({ error: 'entries must be an array' }, { status: 400 })

  await upsertEntries(supabase, entries)
  return NextResponse.json({ ok: true })
}
