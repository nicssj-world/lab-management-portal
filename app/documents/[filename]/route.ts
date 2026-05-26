import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { buildDocumentDownloadFilename, contentDispositionForDownload } from '@/lib/documents/download-filename'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextResponse } from 'next/server'

function codeCandidates(filename: string) {
  const decoded = decodeURIComponent(filename)
  const withoutExt = decoded.replace(/\.[^.]+$/, '').trim()
  const firstToken = withoutExt.split(/\s+/)[0]?.trim()

  return Array.from(new Set([withoutExt, firstToken]
    .filter(Boolean)
    .map(value => value.toUpperCase())))
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const candidates = codeCandidates(filename)

  if (candidates.length === 0) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const { data: doc, error } = await supabaseAdmin
    .from('documents')
    .select('id, visibility, file_url, document_code, title, file_name')
    .in('document_code', candidates)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !doc || doc.visibility !== 'Public') {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: doc.file_url,
      ResponseContentDisposition: contentDispositionForDownload(
        buildDocumentDownloadFilename(doc)
      ),
    }),
    { expiresIn: 3600 }
  )

  supabaseAdmin.from('document_access_logs')
    .insert({ document_id: doc.id, user_id: null, action: 'download' })
    .then(undefined, () => {})

  return NextResponse.redirect(url)
}
