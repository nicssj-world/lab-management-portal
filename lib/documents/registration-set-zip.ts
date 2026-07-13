import { GetObjectCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { selectRegistrationSetDraft, type RegistrationSetMode } from '@/lib/documents/registration-set-contracts'

export type ZipTarget = {
  key: string
  folder: string
  name: string
  label: string
}

type DraftAttachment = {
  id: string
  draft_id: string
  file_url: string
  file_name: string
}

const UNSAFE_PATH_CHARS = /[<>:"/\\|?*\x00-\x1F]/g

export function safePathPart(value: string | null | undefined, fallback: string) {
  const safe = value
    ?.replace(UNSAFE_PATH_CHARS, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '')
    .trim()
  return safe && safe !== '.' && safe !== '..' ? safe : fallback
}

export function uniquePath(path: string, used: Set<string>) {
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

export function uniqueFolder(value: string | null | undefined, fallback: string, used: Set<string>) {
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

export async function getObjectBytes(target: ZipTarget): Promise<Uint8Array> {
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

/** Team-wide "last downloaded" marker on the main document — fire-and-forget, not
 *  critical to the download itself succeeding. */
export function markRegistrationSetDownloaded(mainId: string, byName: string | null | undefined) {
  supabaseAdmin.from('documents')
    .update({ set_last_downloaded_at: new Date().toISOString(), set_last_downloaded_by_name: byName ?? null })
    .eq('id', mainId)
    .then(undefined, () => {})
}

export type RegistrationSetZipResult =
  | { ok: true; mainDocumentCode: string; targets: ZipTarget[] }
  | { ok: false; error: string; status: number }

/** Gathers every file belonging to a registration set (main document + supporting
 *  documents + their working-revision drafts/attachments + ephemeral attachments) into
 *  a flat list of ZipTargets, all under a single folder named after the main document. */
export async function gatherRegistrationSetZipTargets(mainId: string): Promise<RegistrationSetZipResult> {
  const mainResult = await supabaseAdmin
    .from('documents')
    .select('id, document_code, file_url, file_name, word_url, word_name')
    .eq('id', mainId)
    .is('deleted_at', null)
    .maybeSingle()

  if (mainResult.error) return { ok: false, error: mainResult.error.message, status: 500 }
  const main = mainResult.data
  if (!main) return { ok: false, error: 'ไม่พบเอกสารหลัก', status: 404 }

  const linksResult = await supabaseAdmin
    .from('document_links')
    .select('id, linked_doc_id, set_mode, set_draft_id')
    .eq('document_id', mainId)
    .eq('link_kind', 'set')
    .order('created_at', { ascending: true })

  if (linksResult.error) return { ok: false, error: linksResult.error.message, status: 500 }
  const memberIds = (linksResult.data ?? []).map((link) => link.linked_doc_id)
  const ownedDraftIds = (linksResult.data ?? [])
    .filter((link) => link.set_mode === 'revision' && link.set_draft_id)
    .map((link) => link.set_draft_id as string)
  if (memberIds.length === 0) {
    return { ok: false, error: 'ไม่พบเอกสารสนับสนุนในชุด', status: 404 }
  }

  const [membersResult, draftsResult, attachmentsResult] = await Promise.all([
    supabaseAdmin
      .from('documents')
      .select('id, document_code, file_url, file_name, pending_file_url, pending_file_name, word_url, word_name')
      .in('id', memberIds),
    ownedDraftIds.length > 0
      ? supabaseAdmin
          .from('document_revision_drafts')
          .select('id, document_id, status, file_url, file_name, source_pdf_url, source_pdf_name, word_url, word_name')
          .in('id', ownedDraftIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin
      .from('document_attachments')
      .select('id, file_url, file_name')
      .eq('document_id', mainId)
      .eq('ephemeral', true)
      .order('created_at', { ascending: true }),
  ])

  for (const result of [membersResult, draftsResult, attachmentsResult]) {
    if (result.error) return { ok: false, error: result.error.message, status: 500 }
  }

  const activeDraftIds = (draftsResult.data ?? []).map((draft) => draft.id)
  let draftAttachments: DraftAttachment[] = []
  if (activeDraftIds.length > 0) {
    const draftAttachmentsResult = await supabaseAdmin
      .from('document_revision_draft_attachments')
      .select('id, draft_id, file_url, file_name')
      .in('draft_id', activeDraftIds)
      .order('created_at', { ascending: true })

    if (draftAttachmentsResult.error) {
      return { ok: false, error: draftAttachmentsResult.error.message, status: 500 }
    }
    draftAttachments = draftAttachmentsResult.data ?? []
  }

  const memberById = new Map((membersResult.data ?? []).map((member) => [member.id, member] as const))
  const missingMemberId = memberIds.find((memberId) => !memberById.has(memberId))
  if (missingMemberId) {
    console.error('Registration set ZIP is missing a linked member', { mainDocumentId: mainId, memberId: missingMemberId })
    return { ok: false, error: `ข้อมูลชุดเอกสารไม่ครบ: ไม่พบเอกสารสนับสนุน ${missingMemberId}`, status: 500 }
  }

  const draftById = new Map(
    (draftsResult.data ?? []).map((draft) => [draft.id, draft] as const),
  )
  const draftAttachmentsByDraftId = new Map<string, DraftAttachment[]>()
  for (const attachment of draftAttachments) {
    const grouped = draftAttachmentsByDraftId.get(attachment.draft_id) ?? []
    grouped.push(attachment)
    draftAttachmentsByDraftId.set(attachment.draft_id, grouped)
  }

  const rootFolder = safePathPart(main.document_code, 'main-document')
  const targets: ZipTarget[] = []
  const addTarget = (
    key: string | null,
    name: string | null,
    fallback: string,
    label: string,
  ) => {
    if (!key) return
    targets.push({ key, folder: rootFolder, name: safePathPart(name, fallback), label })
  }

  addTarget(main.file_url, main.file_name, 'official', `ไฟล์ทางการของ ${main.document_code}`)
  addTarget(main.word_url, main.word_name, 'source', `ไฟล์ต้นฉบับของ ${main.document_code}`)

  for (const link of linksResult.data ?? []) {
    const memberId = link.linked_doc_id
    const member = memberById.get(memberId)!
    addTarget(member.file_url, member.file_name, 'official', `ไฟล์ทางการของ ${member.document_code}`)
    addTarget(member.pending_file_url, member.pending_file_name, 'pending', `ไฟล์รอยืนยันของ ${member.document_code}`)
    addTarget(member.word_url, member.word_name, 'source', `ไฟล์ต้นฉบับของ ${member.document_code}`)

    const setMode = link.set_mode as RegistrationSetMode
    if (!setMode) return { ok: false, error: `ข้อมูลชุดเอกสารไม่ครบ: link ${link.id} ไม่มี set_mode`, status: 500 }
    let draft
    try {
      draft = selectRegistrationSetDraft({
        linked_doc_id: memberId,
        set_mode: setMode,
        set_draft_id: link.set_draft_id,
      }, draftById)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'ข้อมูล working revision ในชุดไม่ถูกต้อง', status: 500 }
    }
    if (!draft) continue
    addTarget(draft.file_url, draft.file_name, 'revision-official', `ไฟล์ working revision ของ ${member.document_code}`)
    if (draft.source_pdf_url && draft.source_pdf_url !== draft.file_url) {
      addTarget(draft.source_pdf_url, draft.source_pdf_name, 'revision-content.pdf', `ไฟล์เนื้อหา working revision ของ ${member.document_code}`)
    }
    addTarget(draft.word_url, draft.word_name, 'revision-source', `ไฟล์ต้นฉบับ working revision ของ ${member.document_code}`)
    for (const attachment of draftAttachmentsByDraftId.get(draft.id) ?? []) {
      addTarget(attachment.file_url, attachment.file_name, 'revision-attachment', `ไฟล์แนบ working revision ของ ${member.document_code}`)
    }
  }

  for (const attachment of attachmentsResult.data ?? []) {
    addTarget(attachment.file_url, attachment.file_name, 'attachment', `ไฟล์แนบ ${attachment.file_name}`)
  }

  if (targets.length === 0) return { ok: false, error: 'ไม่มีไฟล์ในชุดให้ดาวน์โหลด', status: 404 }

  return { ok: true, mainDocumentCode: main.document_code, targets }
}
