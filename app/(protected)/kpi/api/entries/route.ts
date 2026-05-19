import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDashboard, upsertEntries } from '@/lib/queries/kpi'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? '0', 10)
  const month = parseInt(searchParams.get('month') ?? '0', 10)
  const dept = searchParams.get('dept') ?? undefined

  if (!year || !month) return NextResponse.json({ error: 'year and month are required' }, { status: 400 })

  const data = await getDashboard(supabase, year, month, dept)
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { entries } = await request.json()
  if (!Array.isArray(entries)) return NextResponse.json({ error: 'entries must be an array' }, { status: 400 })

  await upsertEntries(supabase, entries)
  return NextResponse.json({ ok: true })
}
