import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getTestByCatalogParam } from '@/lib/queries/tests'
import { PUBLIC_TEST_FIELDS, sanitizeTest, sanitizeTestDocument } from '@/lib/catalog/public-test'
import type { Category, TestDocument, TestReferenceRange } from '@/lib/supabase/types'

type Params = { params: Promise<{ id: string }> }

function toMsg(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    return String(e.message ?? e.error ?? JSON.stringify(err))
  }
  return String(err)
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const test = await getTestByCatalogParam(supabaseAdmin, id)
    if (!test || test.active === false) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [rangesRes, docsRes] = await Promise.all([
      supabaseAdmin.from('test_reference_ranges').select('*').eq('test_id', test.id).order('sort_order'),
      supabaseAdmin.from('test_documents').select('id,test_id,doc_type,name,created_at').eq('test_id', test.id).order('created_at'),
    ])

    if (rangesRes.error) throw rangesRes.error
    if (docsRes.error) throw docsRes.error

    return NextResponse.json({
      test: sanitizeTest(test),
      category: ((test as any).categories ?? null) as Category | null,
      referenceRanges: (rangesRes.data ?? []) as TestReferenceRange[],
      documents: (docsRes.data ?? []).map((doc) => sanitizeTestDocument(doc as TestDocument)),
    })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
