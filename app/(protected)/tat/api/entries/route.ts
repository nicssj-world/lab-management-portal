import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getTATSummary,
  getTATTrend,
  getTATByDept,
  getTATHeatmap,
  getTATDistribution,
} from '@/lib/queries/tat'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const dept = searchParams.get('dept') ?? undefined
  const view = searchParams.get('view') ?? 'summary'

  try {
    if (view === 'summary') {
      const data = await getTATSummary(supabase, year, month, dept)
      return NextResponse.json(data)
    }
    if (view === 'trend') {
      const data = await getTATTrend(supabase, year, dept)
      return NextResponse.json(data)
    }
    if (view === 'dept') {
      const data = await getTATByDept(supabase, year, month)
      return NextResponse.json(data)
    }
    if (view === 'heatmap') {
      const data = await getTATHeatmap(supabase, year, month, dept)
      return NextResponse.json(data)
    }
    if (view === 'dist') {
      const data = await getTATDistribution(supabase, year, month, dept)
      return NextResponse.json(data)
    }
    return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
