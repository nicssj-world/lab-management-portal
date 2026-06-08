import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireResource } from '@/lib/auth/guards'
import { getWorkloadSummary, getDeptDetail, getMonthlyTrend, upsertWorkload } from '@/lib/queries/workload'

export async function GET(request: NextRequest) {
  const guard = await requireResource('Workload', 'view')
  if (guard.response) return guard.response

  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? '0', 10)
  const month = parseInt(searchParams.get('month') ?? '0', 10)
  const dept = searchParams.get('dept') ?? undefined
  const view = searchParams.get('view') ?? 'summary'

  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })

  let data
  if (view === 'trend') {
    data = await getMonthlyTrend(supabase, year)
  } else if (view === 'detail' && dept) {
    data = await getDeptDetail(supabase, dept, year, month)
  } else {
    if (!month) return NextResponse.json({ error: 'month required for summary' }, { status: 400 })
    data = await getWorkloadSummary(supabase, year, month)
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const guard = await requireResource('Workload', 'edit')
  if (guard.response) return guard.response

  const supabase = await createClient()

  const { entries } = await request.json()
  if (!Array.isArray(entries)) return NextResponse.json({ error: 'entries must be an array' }, { status: 400 })

  for (const e of entries) {
    if (e.in_time_count > e.total_count) {
      return NextResponse.json({ error: `in_time_count (${e.in_time_count}) > total_count (${e.total_count}) for test_id ${e.test_id}` }, { status: 400 })
    }
  }

  await upsertWorkload(supabase, entries)
  return NextResponse.json({ ok: true })
}
