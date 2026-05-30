import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnnualData } from '@/lib/queries/kpi'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? '0', 10)
  const dept = searchParams.get('dept') ?? undefined

  if (!year) return NextResponse.json({ error: 'year is required' }, { status: 400 })

  const data = await getAnnualData(supabase, year, dept || undefined)
  return NextResponse.json(data)
}
