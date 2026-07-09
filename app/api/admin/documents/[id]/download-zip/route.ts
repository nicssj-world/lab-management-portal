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
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  const { id } = await params

  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('id, document_code, revision, file_url, file_name, word_url, word_name, visibility')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'ไม่พบเอกสาร' }, { status: 404 })
  if (doc.visibility !== 'Public' && !(await canAccessDocuments(actor, 'view'))) return jsonForbidden()

  // Word/Excel source is only included for roles allowed to download source files
  const canDownloadSource = actor.role === 'Admin' || (actor.doc_role ?? actor.role) === 'Document Controller'

  const [{ data: links }, { data: attachments }] = await Promise.all([
    supabaseAdmin
      .from('document_links')
      .select('documents!document_links_linked_doc_id_fkey(file_url, file_name)')
      .eq('document_id', id),
    supabaseAdmin
      .from('document_attachments')
      .select('file_url, file_name')
      .eq('document_id', id)
      .order('created_at', { ascending: true }),
  ])

  const targets: { key: string; name: string }[] = []
  if (doc.file_url) targets.push({ key: doc.file_url, name: doc.file_name ?? 'official' })
  if (canDownloadSource && doc.word_url) targets.push({ key: doc.word_url, name: doc.word_name ?? 'source' })
  for (const l of links ?? []) {
    const linked = l.documents as unknown as { file_url: string | null; file_name: string | null } | null
    if (linked?.file_url) targets.push({ key: linked.file_url, name: linked.file_name ?? 'linked' })
  }
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
  const code = (doc.document_code ?? 'document').replace(/[^a-zA-Z0-9._-]/g, '_')
  const zipName = `${code}-Rev${doc.revision ?? ''}.zip`

  supabaseAdmin.from('document_access_logs')
    .insert({ document_id: id, user_id: actor.id, action: 'download' })
    .then(undefined, () => {})

  return new NextResponse(zipped, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
      'Content-Length': String(zipped.byteLength),
    },
  })
}
