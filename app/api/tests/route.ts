import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getTests } from '@/lib/queries/tests'
import type { Test } from '@/lib/supabase/types'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

const PUBLIC_TEST_FIELDS = [
  'id',
  'code',
  'cgd',
  'loinc',
  'th',
  'en',
  'category_id',
  'tube',
  'volume',
  'method',
  'tat',
  'tat_hours',
  'service',
  'price',
  'ref',
  'stability',
  'reject',
  'priority',
  'popular',
  'active',
  'updated_at',
  'lis_code',
  'short_name',
  'description',
  'department',
  'instrument',
  'methodology_note',
  'tat_minutes',
  'urgent_tat_minutes',
  'available_24hr',
  'tube_color',
  'transport_condition',
  'specimen_note',
  'contact_name',
  'contact_phone',
  'contact_email',
  'contact_note',
  'ref_note',
  'contact_staff',
  'related_doc_ids',
] as const

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

function sanitizeTest(test: Test) {
  return Object.fromEntries(
    PUBLIC_TEST_FIELDS.map((field) => [field, test[field]])
  )
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
