import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'
import { buildDocumentDownloadFilename, contentDispositionForDownload, contentDispositionForInline } from '@/lib/documents/download-filename'
import { canAccessDocuments, getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'

type DownloadDocument = {
  id: string
  document_code: string
  title: string
  file_name?: string | null
  file_url?: string | null
  file_size?: number | null
  mime_type?: string | null
  type?: string | null
  status?: string | null
  revision?: string | null
  effective_date?: string | null
  cover_metadata?: Record<string, unknown> | null
  visibility?: string | null
  deleted_at?: string | null
}

async function getDocumentForDownload(path: string) {
  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('id, document_code, title, file_url, file_name, file_size, mime_type, type, status, revision, effective_date, cover_metadata, visibility, deleted_at')
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

  if (revision?.document_id) {
    const { data: revisionDoc } = await supabaseAdmin
      .from('documents')
      .select('id, document_code, title, visibility, deleted_at')
      .eq('id', revision.document_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (revisionDoc) return { ...revisionDoc, file_name: revision.file_name } as DownloadDocument
  }

  // Working revision draft files
  const { data: draft } = await supabaseAdmin
    .from('document_revision_drafts')
    .select('document_id, file_url, file_name, word_url, word_name')
    .or(`file_url.eq.${path},word_url.eq.${path}`)
    .is('cancelled_at', null)
    .maybeSingle()

  if (draft?.document_id) {
    const { data: draftDoc } = await supabaseAdmin
      .from('documents')
      .select('id, document_code, title, visibility, deleted_at')
      .eq('id', draft.document_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (draftDoc) {
      return {
        ...draftDoc,
        file_name: draft.word_url === path ? draft.word_name : draft.file_name,
      } as DownloadDocument
    }
  }

  // Attachment file
  const { data: attachment } = await supabaseAdmin
    .from('document_attachments')
    .select('id, file_name, document_id')
    .eq('file_url', path)
    .maybeSingle()

  if (attachment?.document_id) {
    const { data: attachDoc } = await supabaseAdmin
      .from('documents')
      .select('id, document_code, title, visibility, deleted_at')
      .eq('id', attachment.document_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (attachDoc) return { id: attachDoc.id, file_name: attachment.file_name, visibility: attachDoc.visibility, deleted_at: attachDoc.deleted_at } as unknown as DownloadDocument
  }

  return null
}

export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 422 })
  const inline = req.nextUrl.searchParams.get('inline') === '1'

  const docRow = await getDocumentForDownload(path)
  if (!docRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (docRow.visibility !== 'Public' && !(await canAccessDocuments(actor, 'view'))) return jsonForbidden()

  const filename = buildDocumentDownloadFilename(docRow)

  const disposition = filename
    ? (inline ? contentDispositionForInline(filename) : contentDispositionForDownload(filename))
    : undefined

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
      ...(disposition ? { ResponseContentDisposition: disposition } : {}),
    }),
    { expiresIn: 3600 }
  )

  supabaseAdmin.from('document_access_logs')
    .insert({ document_id: docRow.id, user_id: actor.id, action: 'download' })
    .then(undefined, () => {})

  return NextResponse.json({ url })
}
