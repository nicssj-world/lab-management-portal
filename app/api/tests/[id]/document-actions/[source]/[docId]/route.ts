import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { canUseDocumentAction, normalizeDocumentAccess, type DocumentAction } from '@/lib/tests/document-access'

type Params = { params: Promise<{ id: string; source: string; docId: string }> }

function disposition(action: DocumentAction, fileName: string) {
  const encoded = encodeURIComponent(fileName)
  return action === 'download'
    ? `attachment; filename*=UTF-8''${encoded}`
    : `inline; filename*=UTF-8''${encoded}`
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id, source, docId } = await params
  const testId = Number(id)
  const action = req.nextUrl.searchParams.get('action')
  if (!Number.isInteger(testId) || testId <= 0 || (action !== 'view' && action !== 'download')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: test } = await supabaseAdmin
    .from('tests')
    .select('active, related_doc_ids, related_doc_access')
    .eq('id', testId)
    .single()
  if (!test?.active) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let key = ''
  let fileName = ''
  let allowed = false

  if (source === 'library') {
    const relatedDocIds = (test.related_doc_ids ?? []) as string[]
    if (!relatedDocIds.includes(docId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: document } = await supabaseAdmin
      .from('documents')
      .select('file_url, file_name, document_code, title, visibility, status')
      .eq('id', docId)
      .is('deleted_at', null)
      .eq('visibility', 'Public')
      .eq('status', 'Published')
      .single()
    if (!document?.file_url) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const access = normalizeDocumentAccess(document.visibility, (test.related_doc_access ?? {})[docId])
    allowed = canUseDocumentAction(access.accessMode, action)
    key = document.file_url
    fileName = document.file_name ?? `${document.document_code} ${document.title}`
  } else if (source === 'attachment') {
    const documentId = Number(docId)
    if (!Number.isInteger(documentId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: document } = await supabaseAdmin
      .from('test_documents')
      .select('storage_path, name, visibility, access_mode')
      .eq('id', documentId)
      .eq('test_id', testId)
      .eq('visibility', 'Public')
      .single()
    if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const access = normalizeDocumentAccess(document.visibility, document.access_mode)
    allowed = canUseDocumentAction(access.accessMode, action)
    key = document.storage_path
    fileName = document.name
  } else {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!allowed) return NextResponse.json({ error: 'Document action is not allowed' }, { status: 403 })

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, ResponseContentDisposition: disposition(action, fileName) }),
    { expiresIn: 3600 },
  )
  return NextResponse.json({ url })
}
