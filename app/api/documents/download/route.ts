import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'
import { buildDocumentDownloadFilename, contentDispositionForDownload, contentDispositionForInline } from '@/lib/documents/download-filename'
import { r2ObjectResponse } from '@/lib/r2/stream-response'
import {
  InvalidDeliveryVariantError,
  UnsupportedEligibleDocumentError,
  parseDeliveryVariant,
  resolveServedKey,
} from '@/lib/documents/document-delivery-variant'

export const runtime = 'nodejs'

// Public download endpoint — only serves documents with visibility='Public'
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 422 })
  let variant
  try {
    variant = parseDeliveryVariant(req.nextUrl.searchParams.get('variant'))
  } catch (error) {
    if (error instanceof InvalidDeliveryVariantError) return NextResponse.json({ error: error.message }, { status: 422 })
    throw error
  }
  const proxy = req.nextUrl.searchParams.get('proxy') === '1'

  // Verify document is public before serving
  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('id, visibility, file_url, document_code, title, file_name, file_size, mime_type, type, status, revision, effective_date, cover_metadata, deleted_at')
    .eq('file_url', path)
    .eq('status', 'Published')
    .is('deleted_at', null)
    .maybeSingle()

  if (!doc || doc.visibility !== 'Public' || doc.status !== 'Published') {
    return NextResponse.json({ error: 'Not found or not public' }, { status: 404 })
  }

  let servedKey: string
  let uncontrolledPreview = false
  try {
    const served = await resolveServedKey({
      document: {
        id: doc.id,
        file_url: doc.file_url,
        file_name: doc.file_name ?? null,
        mime_type: doc.mime_type ?? null,
        type: doc.type ?? '',
        status: doc.status ?? '',
      },
      audience: 'public',
      variant,
      now: new Date(),
    })
    servedKey = served.key
    uncontrolledPreview = served.uncontrolled
  } catch (error) {
    if (error instanceof UnsupportedEligibleDocumentError) return NextResponse.json({ error: error.message }, { status: 415 })
    return NextResponse.json({ error: 'ไม่สามารถสร้างเอกสารไม่ควบคุมได้ กรุณาลองใหม่อีกครั้ง' }, { status: 503 })
  }

  const filename = buildDocumentDownloadFilename(doc)
  const inline = variant === 'preview'
  const disposition = inline ? contentDispositionForInline(filename) : contentDispositionForDownload(filename)

  if (proxy) {
    const object = await r2.send(new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: servedKey,
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
      Key: servedKey,
      ResponseContentDisposition: disposition,
    }),
    { expiresIn: 3600 }
  )

  if (variant === 'download') {
    supabaseAdmin.from('document_access_logs')
      .insert({ document_id: doc.id, user_id: null, action: 'download' })
      .then(undefined, () => {})
  }

  return NextResponse.json({ url, preview_uncontrolled: variant === 'preview' && uncontrolledPreview })
}
