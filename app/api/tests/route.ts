import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getTests } from '@/lib/queries/tests'
import { sanitizeTest } from '@/lib/catalog/public-test'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

function toMsg(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    return String(e.message ?? e.error ?? JSON.stringify(err))
  }
  return String(err)
}

function toNumber(value: string | null, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const pageSize = Math.min(
      Math.max(toNumber(sp.get('pageSize'), DEFAULT_PAGE_SIZE), 1),
      MAX_PAGE_SIZE
    )
    const sortDir = sp.get('sortDir')

    const result = await getTests(supabaseAdmin, {
      search: sp.get('search') ?? undefined,
      category: sp.get('category') ?? undefined,
      tube: sp.get('tube') ?? undefined,
      active: true,
      page: Math.max(toNumber(sp.get('page'), 0), 0),
      pageSize,
      sortBy: sp.get('sortBy') ?? undefined,
      sortDir: sortDir === 'desc' ? 'desc' : 'asc',
    })

    return NextResponse.json({
      data: result.data.map((test) => sanitizeTest(test)),
      count: result.count,
    })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
