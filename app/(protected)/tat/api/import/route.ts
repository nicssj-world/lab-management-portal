import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { insertTATBatch } from '@/lib/queries/tat'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? '')
  const month = parseInt(searchParams.get('month') ?? '')

  if (isNaN(year) || isNaN(month)) {
    return NextResponse.json({ error: 'year and month required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tat_import_batches')
    .select('id, row_count, created_at')
    .eq('fiscal_year', year)
    .eq('month', month)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ existing: data ?? null })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (!['Manager', 'Admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { batchMeta, entries } = body as {
      batchMeta: { filename: string; fiscal_year: number; month: number }
      entries: {
        lab_number?: string
        test_code?: string
        test_name?: string
        dept_code?: string
        received_at: string
        resulted_at: string
        fiscal_year: number
        month: number
      }[]
    }

    const result = await insertTATBatch(supabase, { ...batchMeta, imported_by: session.user.id }, entries)
    return NextResponse.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
