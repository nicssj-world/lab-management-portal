import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { buildDocumentDownloadFilename, contentDispositionForDownload } from '@/lib/documents/download-filename'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextResponse } from 'next/server'
import {
  UnsupportedEligibleDocumentError,
  resolveServedKey,
} from '@/lib/documents/document-delivery-variant'

export const runtime = 'nodejs'

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
    .select('id, visibility, file_url, document_code, title, file_name, file_size, mime_type, type, status, revision, effective_date, cover_metadata')
    .in('document_code', candidates)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !doc || doc.visibility !== 'Public' || doc.status !== 'Published' || !doc.file_url) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  let servedKey: string
  try {
    servedKey = (await resolveServedKey({
      document: {
        id: doc.id,
        file_url: doc.file_url,
        file_name: doc.file_name ?? null,
        mime_type: doc.mime_type ?? null,
        type: doc.type ?? '',
        status: doc.status ?? '',
      },
      audience: 'public',
      variant: 'download',
      now: new Date(),
    })).key
  } catch (cause) {
    if (cause instanceof UnsupportedEligibleDocumentError) return NextResponse.json({ error: cause.message }, { status: 415 })
    return NextResponse.json({ error: 'ไม่สามารถสร้างเอกสารไม่ควบคุมได้ กรุณาลองใหม่อีกครั้ง' }, { status: 503 })
  }

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: servedKey,
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
