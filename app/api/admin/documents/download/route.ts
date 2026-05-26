import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'
import { buildDocumentDownloadFilename, contentDispositionForDownload } from '@/lib/documents/download-filename'

async function getDocumentForDownload(path: string) {
  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('id, document_code, title, file_name')
    .eq('file_url', path)
    .maybeSingle()

  if (doc) return doc

  const { data: revision } = await supabaseAdmin
    .from('document_revisions')
    .select('document_id, file_name')
    .eq('file_url', path)
    .maybeSingle()

  if (!revision?.document_id) return null

  const { data: revisionDoc } = await supabaseAdmin
    .from('documents')
    .select('id, document_code, title')
    .eq('id', revision.document_id)
    .maybeSingle()

  return revisionDoc
    ? { ...revisionDoc, file_name: revision.file_name }
    : null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 422 })

  const docRow = await getDocumentForDownload(path)
  const filename = docRow ? buildDocumentDownloadFilename(docRow) : undefined

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
      ...(filename
        ? { ResponseContentDisposition: contentDispositionForDownload(filename) }
        : {}),
    }),
    { expiresIn: 3600 }
  )

  supabaseAdmin.from('document_access_logs')
    .insert({ document_id: docRow?.id ?? null, user_id: user.id, action: 'download' })
    .then(undefined, () => {})

  return NextResponse.json({ url })
}
