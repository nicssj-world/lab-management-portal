import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import JSZip from 'jszip'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessDocuments, getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'

async function getObjectBytes(key: string): Promise<Uint8Array | null> {
  try {
    const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    const body = object.Body
    if (!body) return null
    if ('transformToByteArray' in body && typeof body.transformToByteArray === 'function') {
      return await body.transformToByteArray()
    }
    const chunks: Uint8Array[] = []
    for await (const chunk of body as AsyncIterable<Uint8Array | Buffer>) {
      chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk))
    }
    return new Uint8Array(Buffer.concat(chunks))
  } catch {
    return null
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; draftId: string }> }
) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!(await canAccessDocuments(actor, 'view'))) return jsonForbidden()

  const { id, draftId } = await params

  const { data: draft } = await supabaseAdmin
    .from('document_revision_drafts')
    .select('id, document_id, revision, file_url, file_name, source_pdf_url, source_pdf_name, word_url, word_name')
    .eq('id', draftId)
    .eq('document_id', id)
    .maybeSingle()
  if (!draft) return NextResponse.json({ error: 'ไม่พบ working revision' }, { status: 404 })

  const { data: parentDoc } = await supabaseAdmin
    .from('documents')
    .select('document_code')
    .eq('id', id)
    .maybeSingle()

  const { data: attachments } = await supabaseAdmin
    .from('document_revision_draft_attachments')
    .select('file_url, file_name')
    .eq('draft_id', draftId)
    .order('created_at', { ascending: true })

  // Word/Excel source is only included for roles allowed to download source files
  const canDownloadSource = actor.role === 'Admin' || (actor.doc_role ?? actor.role) === 'Document Controller'

  const targets: { key: string; name: string }[] = []
  if (draft.file_url) targets.push({ key: draft.file_url, name: draft.file_name ?? 'official' })
  if (draft.source_pdf_url && draft.source_pdf_url !== draft.file_url) {
    targets.push({ key: draft.source_pdf_url, name: draft.source_pdf_name ?? 'content.pdf' })
  }
  if (canDownloadSource && draft.word_url) targets.push({ key: draft.word_url, name: draft.word_name ?? 'source' })
  for (const a of attachments ?? []) {
    if (a.file_url) targets.push({ key: a.file_url, name: a.file_name })
  }

  if (targets.length === 0) return NextResponse.json({ error: 'ไม่มีไฟล์ให้ดาวน์โหลด' }, { status: 404 })

  // Build the zip — de-duplicate identical filenames by suffixing an index
  const zip = new JSZip()
  const used = new Set<string>()
  let added = 0
  let i = 0
  for (const t of targets) {
    i++
    const bytes = await getObjectBytes(t.key)
    if (!bytes) continue
    let name = t.name || `file-${i}`
    if (used.has(name)) {
      const dot = name.lastIndexOf('.')
      name = dot > 0 ? `${name.slice(0, dot)}-${i}${name.slice(dot)}` : `${name}-${i}`
    }
    used.add(name)
    zip.file(name, bytes)
    added++
  }

  if (added === 0) return NextResponse.json({ error: 'ไม่พบไฟล์ใน storage' }, { status: 404 })

  const zipped = await zip.generateAsync({ type: 'arraybuffer' })
  const code = (parentDoc?.document_code ?? 'document').replace(/[^a-zA-Z0-9._-]/g, '_')
  const zipName = `${code}-Rev${draft.revision ?? ''}-draft.zip`

  return new NextResponse(zipped, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
      'Content-Length': String(zipped.byteLength),
    },
  })
}
