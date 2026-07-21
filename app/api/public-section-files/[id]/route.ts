import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { contentDispositionForDownload, contentDispositionForInline } from '@/lib/documents/download-filename'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

// Public delivery for files an admin uploaded straight into a section. These are not
// controlled quality documents, so no uncontrolled stamping applies — but the R2 key is
// always resolved from the database, never taken from the request.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const variant = req.nextUrl.searchParams.get('variant') === 'preview' ? 'preview' : 'download'

  const { data: upload } = await supabaseAdmin
    .from('public_section_uploads')
    .select('id, name, file_key, file_name, mime_type')
    .eq('id', id)
    .maybeSingle()
  if (!upload) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 })

  // Orphaned or hidden files must not stay reachable by direct URL.
  const { data: reference } = await supabaseAdmin
    .from('public_document_section_items')
    .select('id, public_document_sections!inner(visible)')
    .eq('upload_id', id)
    .eq('public_document_sections.visible', true)
    .limit(1)
    .maybeSingle()
  if (!reference) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 })

  const filename = upload.file_name || upload.name
  const disposition = variant === 'preview'
    ? contentDispositionForInline(filename)
    : contentDispositionForDownload(filename)

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: upload.file_key, ResponseContentDisposition: disposition }),
    { expiresIn: 3600 },
  )

  return NextResponse.json({ url })
}
