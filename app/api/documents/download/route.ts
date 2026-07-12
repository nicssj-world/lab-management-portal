import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'
import { buildDocumentDownloadFilename, contentDispositionForDownload, contentDispositionForInline } from '@/lib/documents/download-filename'
import { r2ObjectResponse } from '@/lib/r2/stream-response'

// Public download endpoint — only serves documents with visibility='Public'
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 422 })
  const inline = req.nextUrl.searchParams.get('inline') === '1'
  const proxy = req.nextUrl.searchParams.get('proxy') === '1'

  // Verify document is public before serving
  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('id, visibility, file_url, document_code, title, file_name, file_size, mime_type, type, status, revision, effective_date, cover_metadata')
    .eq('file_url', path)
    .maybeSingle()

  if (!doc || doc.visibility !== 'Public') {
    return NextResponse.json({ error: 'Not found or not public' }, { status: 404 })
  }

  const filename = buildDocumentDownloadFilename(doc)
  const disposition = inline ? contentDispositionForInline(filename) : contentDispositionForDownload(filename)

  if (proxy) {
    const object = await r2.send(new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
      Range: req.headers.get('range') ?? undefined,
      ResponseContentDisposition: disposition,
    }))
    return r2ObjectResponse(object, {
      contentType: doc.mime_type || 'application/pdf',
      contentDisposition: disposition,
    })
  }

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
      ResponseContentDisposition: disposition,
    }),
    { expiresIn: 3600 }
  )

  supabaseAdmin.from('document_access_logs')
    .insert({ document_id: doc.id, user_id: null, action: 'download' })
    .then(undefined, () => {})

  return NextResponse.json({ url })
}
