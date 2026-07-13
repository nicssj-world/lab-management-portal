import { GetObjectCommand } from '@aws-sdk/client-s3'
import JSZip from 'jszip'
import { NextRequest, NextResponse } from 'next/server'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { contentDispositionForDownload } from '@/lib/documents/download-filename'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

type ZipTarget = {
  key: string
  folder: string
  name: string
  label: string
}

const UNSAFE_PATH_CHARS = /[<>:"/\\|?*\x00-\x1F]/g

function safePathPart(value: string | null | undefined, fallback: string) {
  const safe = value
    ?.replace(UNSAFE_PATH_CHARS, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '')
    .trim()
  return safe && safe !== '.' && safe !== '..' ? safe : fallback
}

function uniquePath(path: string, used: Set<string>) {
  if (!used.has(path)) {
    used.add(path)
    return path
  }

  const slash = path.lastIndexOf('/')
  const directory = slash >= 0 ? path.slice(0, slash + 1) : ''
  const filename = slash >= 0 ? path.slice(slash + 1) : path
  const dot = filename.lastIndexOf('.')
  const stem = dot > 0 ? filename.slice(0, dot) : filename
  const extension = dot > 0 ? filename.slice(dot) : ''
  let suffix = 2
  let candidate = `${directory}${stem}-${suffix}${extension}`
  while (used.has(candidate)) {
    suffix += 1
    candidate = `${directory}${stem}-${suffix}${extension}`
  }
  used.add(candidate)
  return candidate
}

function uniqueFolder(value: string | null | undefined, fallback: string, used: Set<string>) {
  const base = safePathPart(value, fallback)
  let folder = base
  let suffix = 2
  while (used.has(folder)) {
    folder = `${base}-${suffix}`
    suffix += 1
  }
  used.add(folder)
  return folder
}

async function getObjectBytes(target: ZipTarget): Promise<Uint8Array> {
  try {
    const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: target.key }))
    const body = object.Body
    if (!body) throw new Error('storage response has no body')
    if ('transformToByteArray' in body && typeof body.transformToByteArray === 'function') {
      return await body.transformToByteArray()
    }

    const chunks: Uint8Array[] = []
    for await (const chunk of body as AsyncIterable<Uint8Array | Buffer>) {
      chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk))
    }
    return new Uint8Array(Buffer.concat(chunks))
  } catch (error) {
    console.error('Registration set ZIP object fetch failed', {
      key: target.key,
      label: target.label,
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error(`ไม่สามารถดาวน์โหลด ${target.label} จาก storage`)
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  const canDownloadSet = actor.role === 'Admin'
    || actor.role === 'Document Controller'
    || actor.doc_role === 'Document Controller'
  if (!canDownloadSet) return jsonForbidden()

  const { id } = await params
  const mainResult = await supabaseAdmin
    .from('documents')
    .select('id, document_code, file_url, file_name, word_url, word_name')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (mainResult.error) return NextResponse.json({ error: mainResult.error.message }, { status: 500 })
  const main = mainResult.data
  if (!main) return NextResponse.json({ error: 'ไม่พบเอกสารหลัก' }, { status: 404 })

  const linksResult = await supabaseAdmin
    .from('document_links')
    .select('id, linked_doc_id')
    .eq('document_id', id)
    .eq('link_kind', 'set')
    .order('created_at', { ascending: true })

  if (linksResult.error) return NextResponse.json({ error: linksResult.error.message }, { status: 500 })
  const memberIds = (linksResult.data ?? []).map((link) => link.linked_doc_id)
  if (memberIds.length === 0) {
    return NextResponse.json({ error: 'ไม่พบเอกสารสมาชิกในชุด' }, { status: 404 })
  }

  const [membersResult, draftsResult, attachmentsResult, draftAttachmentsResult] = await Promise.all([
    supabaseAdmin
      .from('documents')
      .select('id, document_code, file_url, file_name, pending_file_url, pending_file_name, word_url, word_name')
      .in('id', memberIds),
    supabaseAdmin
      .from('document_revision_drafts')
      .select('id, document_id, file_url, file_name, source_pdf_url, source_pdf_name, word_url, word_name')
      .in('document_id', memberIds)
      .is('cancelled_at', null)
      .neq('status', 'Published'),
    supabaseAdmin
      .from('document_attachments')
      .select('id, file_url, file_name')
      .eq('document_id', id)
      .eq('ephemeral', true)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('document_revision_draft_attachments')
      .select('id, draft_id, document_id, file_url, file_name')
      .in('document_id', memberIds)
      .order('created_at', { ascending: true }),
  ])

  for (const result of [membersResult, draftsResult, attachmentsResult, draftAttachmentsResult]) {
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  const memberById = new Map((membersResult.data ?? []).map((member) => [member.id, member] as const))
  const missingMemberId = memberIds.find((memberId) => !memberById.has(memberId))
  if (missingMemberId) {
    console.error('Registration set ZIP is missing a linked member', { mainDocumentId: id, memberId: missingMemberId })
    return NextResponse.json({ error: `ข้อมูลชุดเอกสารไม่ครบ: ไม่พบเอกสารสมาชิก ${missingMemberId}` }, { status: 500 })
  }

  const draftByDocumentId = new Map(
    (draftsResult.data ?? []).map((draft) => [draft.document_id, draft] as const),
  )
  const draftAttachmentsByDraftId = new Map<string, NonNullable<typeof draftAttachmentsResult.data>>()
  for (const attachment of draftAttachmentsResult.data ?? []) {
    const grouped = draftAttachmentsByDraftId.get(attachment.draft_id) ?? []
    grouped.push(attachment)
    draftAttachmentsByDraftId.set(attachment.draft_id, grouped)
  }

  const usedFolders = new Set<string>(['attachments'])
  const mainFolder = uniqueFolder(main.document_code, 'main-document', usedFolders)
  const targets: ZipTarget[] = []
  const addTarget = (
    key: string | null,
    folder: string,
    name: string | null,
    fallback: string,
    label: string,
  ) => {
    if (!key) return
    targets.push({ key, folder, name: safePathPart(name, fallback), label })
  }

  addTarget(main.file_url, mainFolder, main.file_name, 'official', `ไฟล์ทางการของ ${main.document_code}`)
  addTarget(main.word_url, mainFolder, main.word_name, 'source', `ไฟล์ต้นฉบับของ ${main.document_code}`)

  for (const memberId of memberIds) {
    const member = memberById.get(memberId)!
    const memberFolder = uniqueFolder(member.document_code, `member-${memberId}`, usedFolders)
    addTarget(member.file_url, memberFolder, member.file_name, 'official', `ไฟล์ทางการของ ${member.document_code}`)
    addTarget(member.pending_file_url, memberFolder, member.pending_file_name, 'pending', `ไฟล์รอยืนยันของ ${member.document_code}`)
    addTarget(member.word_url, memberFolder, member.word_name, 'source', `ไฟล์ต้นฉบับของ ${member.document_code}`)

    const draft = draftByDocumentId.get(memberId)
    if (!draft) continue
    addTarget(draft.file_url, memberFolder, draft.file_name, 'revision-official', `ไฟล์ working revision ของ ${member.document_code}`)
    if (draft.source_pdf_url && draft.source_pdf_url !== draft.file_url) {
      addTarget(draft.source_pdf_url, memberFolder, draft.source_pdf_name, 'revision-content.pdf', `ไฟล์เนื้อหา working revision ของ ${member.document_code}`)
    }
    addTarget(draft.word_url, memberFolder, draft.word_name, 'revision-source', `ไฟล์ต้นฉบับ working revision ของ ${member.document_code}`)
    for (const attachment of draftAttachmentsByDraftId.get(draft.id) ?? []) {
      addTarget(attachment.file_url, memberFolder, attachment.file_name, 'revision-attachment', `ไฟล์แนบ working revision ของ ${member.document_code}`)
    }
  }

  for (const attachment of attachmentsResult.data ?? []) {
    addTarget(attachment.file_url, 'attachments', attachment.file_name, 'attachment', `ไฟล์แนบ ${attachment.file_name}`)
  }

  if (targets.length === 0) return NextResponse.json({ error: 'ไม่มีไฟล์ในชุดให้ดาวน์โหลด' }, { status: 404 })

  const zip = new JSZip()
  for (const folder of usedFolders) zip.folder(folder)
  const usedPaths = new Set<string>()
  try {
    for (const target of targets) {
      const bytes = await getObjectBytes(target)
      const path = uniquePath(`${target.folder}/${target.name}`, usedPaths)
      zip.file(path, bytes)
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ไม่สามารถเตรียมไฟล์ ZIP ได้' },
      { status: 502 },
    )
  }

  let zipped: ArrayBuffer
  try {
    zipped = await zip.generateAsync({ type: 'arraybuffer' })
  } catch (error) {
    console.error('Registration set ZIP generation failed', { mainDocumentId: id, error })
    return NextResponse.json({ error: 'ไม่สามารถสร้างไฟล์ ZIP ได้' }, { status: 500 })
  }

  const zipName = `${safePathPart(main.document_code, 'document')}-set.zip`
  supabaseAdmin.from('document_access_logs')
    .insert({ document_id: id, user_id: actor.id, action: 'download' })
    .then(undefined, () => {})

  return new NextResponse(zipped, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': contentDispositionForDownload(zipName),
      'Content-Length': String(zipped.byteLength),
    },
  })
}
