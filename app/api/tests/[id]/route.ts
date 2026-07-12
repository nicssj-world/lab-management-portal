import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getTestByCatalogParam } from '@/lib/queries/tests'
import { sanitizeTest, sanitizeTestDocument, type PublicRelatedTestDocument } from '@/lib/catalog/public-test'
import type { Category, TestDocument, TestReferenceRange } from '@/lib/supabase/types'
import { orderRelatedTestDocuments } from '@/lib/documents/related-test-documents'
import { normalizeDocumentAccess } from '@/lib/tests/document-access'

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

    const relatedDocIds = test.related_doc_ids ?? []
    const [rangesRes, docsRes, relatedRes] = await Promise.all([
      supabaseAdmin.from('test_reference_ranges').select('*').eq('test_id', test.id).order('sort_order'),
      supabaseAdmin.from('test_documents').select('id,test_id,doc_type,name,created_at,visibility,access_mode').eq('test_id', test.id).eq('visibility', 'Public').order('created_at'),
      relatedDocIds.length
        ? supabaseAdmin.from('documents').select('id,document_code,title,type,visibility,status').in('id', relatedDocIds).is('deleted_at', null).eq('visibility', 'Public').eq('status', 'Published')
        : Promise.resolve({ data: [], error: null }),
    ])

    if (rangesRes.error) throw rangesRes.error
    if (docsRes.error) throw docsRes.error
    if (relatedRes.error) throw relatedRes.error

    const accessByDocument = test.related_doc_access ?? {}
    const relatedDocuments = orderRelatedTestDocuments(relatedDocIds, relatedRes.data ?? []).map((doc) => {
      const access = normalizeDocumentAccess(doc.visibility, accessByDocument[doc.id])
      return { id: doc.id, document_code: doc.document_code, title: doc.title, type: doc.type, source: 'library', accessMode: access.accessMode } satisfies PublicRelatedTestDocument
    })

    return NextResponse.json({
      test: sanitizeTest(test),
      category: ((test as any).categories ?? null) as Category | null,
      referenceRanges: (rangesRes.data ?? []) as TestReferenceRange[],
      documents: (docsRes.data ?? []).map((doc) => sanitizeTestDocument(doc as TestDocument)),
      relatedDocuments,
    })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
