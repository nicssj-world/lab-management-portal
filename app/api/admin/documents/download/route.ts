import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'
import { buildDocumentDownloadFilename, contentDispositionForDownload } from '@/lib/documents/download-filename'
import { canAccessDocuments, getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'

type DownloadDocument = {
  id: string
  document_code: string
  title: string
  file_name?: string | null
  visibility?: string | null
  deleted_at?: string | null
}

async function getDocumentForDownload(path: string) {
  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('id, document_code, title, file_name, visibility, deleted_at')
    .eq('file_url', path)
    .is('deleted_at', null)
    .maybeSingle()

  if (doc) return doc as DownloadDocument

  // Word/Excel secondary file
  const { data: wordDoc } = await supabaseAdmin
    .from('documents')
    .select('id, document_code, title, word_name, visibility, deleted_at')
    .eq('word_url', path)
    .is('deleted_at', null)
    .maybeSingle()

  if (wordDoc) return { ...wordDoc, file_name: wordDoc.word_name } as DownloadDocument

  const { data: revision } = await supabaseAdmin
    .from('document_revisions')
    .select('document_id, file_name')
    .eq('file_url', path)
    .maybeSingle()

  if (!revision?.document_id) return null

  const { data: revisionDoc } = await supabaseAdmin
    .from('documents')
    .select('id, document_code, title, visibility, deleted_at')
    .eq('id', revision.document_id)
    .is('deleted_at', null)
    .maybeSingle()

  return revisionDoc
    ? { ...revisionDoc, file_name: revision.file_name } as DownloadDocument
    : null
}

export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 422 })

  const docRow = await getDocumentForDownload(path)
  if (!docRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (docRow.visibility !== 'Public' && !(await canAccessDocuments(actor, 'view'))) return jsonForbidden()

  const filename = buildDocumentDownloadFilename(docRow)

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
    .insert({ document_id: docRow.id, user_id: actor.id, action: 'download' })
    .then(undefined, () => {})

  return NextResponse.json({ url })
}
