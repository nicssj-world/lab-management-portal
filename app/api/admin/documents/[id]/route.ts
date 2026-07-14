import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { DocumentSchema } from '@/lib/validations/document'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessDocuments } from '@/lib/auth/guards'
import { allowedTransitions, type DocStatus } from '@/lib/documents/transitions'
import {
  canCorrectPublishedMetadata,
  canMoveToStatus,
  COVER_GENERATION_ENABLED,
  isCoverRequiredType,
  isPdfFile,
  isPublishedCoverMetadataField,
  isPublishedMetadataField,
  isSourceFile,
} from '@/lib/documents/workflow'
import { isDocxFile, patchDocxHeaderMetadata, type DocxHeaderMetadata } from '@/lib/documents/docx-header'
import { isXlsxFile, patchXlsxHeaderMetadata } from '@/lib/documents/xlsx-header'
import { buildDocxHeaderMetadata } from '@/lib/documents/metadata'
import { stampPublishedPdfFooter } from '@/lib/documents/date-inject'
import { purgeEphemeralAttachments } from '@/lib/documents/ephemeral-attachments'
import {
  findRegistrationSetTransitionBlocker,
  validateIncomingSetTransition,
  type RegistrationSetMode,
} from '@/lib/documents/registration-set-contracts'
import { getActiveIncomingDocumentSetMemberships } from '@/lib/documents/active-registration-sets'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role, doc_role, name').eq('id', user.id).single()
  return data as { id: string; role: string; doc_role: string | null; name: string | null } | null
}

function toMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

async function uploadDocumentObject(file: File, type: string, prefix = '', headerMetadata?: DocxHeaderMetadata) {
  const year = new Date().getFullYear()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const r2Key = `documents/${type.toLowerCase()}/${year}/${Date.now()}-${prefix}${safeName}`
  let body: Buffer<ArrayBufferLike> = Buffer.from(await file.arrayBuffer())
  if (headerMetadata) {
    if (isDocxFile(file)) {
      body = await patchDocxHeaderMetadata(body, headerMetadata)
    } else if (isXlsxFile(file)) {
      body = await patchXlsxHeaderMetadata(body, headerMetadata)
    }
  }
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    Body: body,
    ContentType: file.type || 'application/octet-stream',
  }))
  return { key: r2Key, size: body.length }
}

async function getObjectBuffer(key: string) {
  const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  const body = object.Body
  if (!body) throw new Error('ไม่พบไฟล์ต้นฉบับใน R2')
  if ('transformToByteArray' in body && typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray())
  }
  const chunks: Uint8Array[] = []
  for await (const chunk of body as AsyncIterable<Uint8Array | Buffer>) {
    chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk))
  }
  return Buffer.concat(chunks)
}

async function getStoredObjectSize(key: string) {
  const object = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  return object.ContentLength ?? null
}

async function patchR2DocxObject(key: string, metadata: DocxHeaderMetadata) {
  const original = await getObjectBuffer(key)
  const patched = await patchDocxHeaderMetadata(original, metadata)
  if (patched.equals(original)) return null
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: patched,
    ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }))
  return patched.length
}

async function patchR2XlsxObject(key: string, metadata: DocxHeaderMetadata) {
  const original = await getObjectBuffer(key)
  const patched = await patchXlsxHeaderMetadata(original, metadata)
  if (patched.equals(original)) return null
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: patched,
    ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }))
  return patched.length
}

function todayIsoDate() {
  return new Date().toISOString().split('T')[0]
}

function parseDateOnly(value: string | null | undefined) {
  const clean = value?.trim()
  if (!clean) return null
  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const parsed = new Date(clean)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const DOC_UPLOAD_ROLES = ['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer']
const DOC_DELETE_ROLES = ['Laboratory Director', 'Document Controller']
const STATUS_CHANGE_INPUT_FIELDS = new Set(['status', 'obsolete_reason'])

async function canUploadDocument(role: string, docRole: string | null) {
  if (role === 'Admin') return true
  if (DOC_UPLOAD_ROLES.includes(docRole ?? role)) return true
  const perms = await getRolePermissions(role)
  return (perms['เอกสารคุณภาพ'] ?? 'none') === 'edit'
}

function canDeleteDocument(role: string, docRole: string | null) {
  if (role === 'Admin') return true
  return DOC_DELETE_ROLES.includes(docRole ?? role)
}

async function getRegistrationSetTransitionBlocker(documentId: string, targetStatus: string) {
  const linksResult = await supabaseAdmin
    .from('document_links')
    .select('linked_doc_id, set_mode, set_draft_id')
    .eq('document_id', documentId)
    .eq('link_kind', 'set')
  if (linksResult.error) throw linksResult.error
  const links = linksResult.data ?? []
  if (links.length === 0) return null

  const memberIds = Array.from(new Set(links.map((link) => link.linked_doc_id)))
  const draftIds = Array.from(new Set(
    links.filter((link) => link.set_mode === 'revision' && link.set_draft_id).map((link) => link.set_draft_id as string),
  ))
  const [documentsResult, draftsResult] = await Promise.all([
    supabaseAdmin.from('documents').select('id, document_code, status').in('id', memberIds).is('deleted_at', null),
    draftIds.length > 0
      ? supabaseAdmin.from('document_revision_drafts').select('id, document_id, status').in('id', draftIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (documentsResult.error) throw documentsResult.error
  if (draftsResult.error) throw draftsResult.error

  return findRegistrationSetTransitionBlocker(
    links.map((link) => ({
      linked_doc_id: link.linked_doc_id,
      set_mode: link.set_mode as RegistrationSetMode,
      set_draft_id: link.set_draft_id,
    })),
    new Map((documentsResult.data ?? []).map((document) => [document.id, document] as const)),
    new Map((draftsResult.data ?? []).map((draft) => [draft.id, draft] as const)),
    targetStatus,
  )
}

// A document that is a MEMBER of some other document's active set cannot be deleted on its
// own — deletion must go through that set's main document instead (findActiveSetAsMain below
// cascades to members). Delegates to the same membership lookup used by the status-transition
// guard so both places agree on what "active" means.
async function findActiveRegistrationSet(documentId: string) {
  const memberships = await getActiveIncomingDocumentSetMemberships(documentId)
  const membership = memberships[0]
  if (!membership) return null
  return { document_code: membership.mainDocumentCode, status: membership.mainStatus }
}

// documentId is the MAIN document of a still-active set (status Draft/Review/Approved) —
// returns its set links so DELETE can cascade: drop 'registered' members, cancel 'revision'
// members' owned draft, and merely unlink 'linked' members (they're independent Published
// documents referenced by the set, not owned by it).
async function findActiveSetAsMain(documentId: string) {
  const linksResult = await supabaseAdmin
    .from('document_links')
    .select('id, linked_doc_id, set_mode, set_draft_id')
    .eq('document_id', documentId)
    .eq('link_kind', 'set')
  if (linksResult.error) throw linksResult.error
  const links = linksResult.data ?? []
  if (links.length === 0) return null
  const mainResult = await supabaseAdmin
    .from('documents')
    .select('id, document_code, status')
    .eq('id', documentId)
    .in('status', ['Draft', 'Review', 'Approved'])
    .is('deleted_at', null)
    .maybeSingle()
  if (mainResult.error) throw mainResult.error
  if (!mainResult.data) return null
  return { main: mainResult.data, links }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDocuments(actor, 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  let query = supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)

  if (actor.doc_role === 'Viewer') {
    query = query.eq('status', 'Published')
  }

  const { data, error } = await query.single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!(await canUploadDocument(actor.role, actor.doc_role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const contentType = req.headers.get('content-type') ?? ''
    let updates: Record<string, unknown> = {}
    let newFile: File | null = null
    const warnings: string[] = []

    let newWordFile: File | null = null
    let wordFileKey: string | null = null
    let wordFileName: string | null = null
    let wordFileSizePre: number | null = null
    let fileKey: string | null = null
    let fileKeyName: string | null = null
    let fileKeyType: string | null = null
    let fileKeySizePre: number | null = null
    let pendingFileKeyToDelete: string | null = null
    let wordFileKeyToDelete: string | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const fileRaw = form.get('file')
      newFile = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null
      const wordRaw = form.get('word_file')
      newWordFile = wordRaw instanceof File && wordRaw.size > 0 ? wordRaw : null
      wordFileKey = (form.get('word_file_key') as string | null)?.trim() || null
      wordFileName = (form.get('word_file_name') as string | null)?.trim() || null
      wordFileSizePre = (form.get('word_file_size') != null) ? Number(form.get('word_file_size')) : null
      fileKey = (form.get('file_key') as string | null)?.trim() || null
      fileKeyName = (form.get('file_name') as string | null)?.trim() || null
      fileKeyType = (form.get('file_type') as string | null)?.trim() || null
      fileKeySizePre = (form.get('file_size') != null) ? Number(form.get('file_size')) : null

      const metaRaw = form.get('meta')
      if (metaRaw) {
        const parsed = DocumentSchema.partial().safeParse(JSON.parse(metaRaw as string))
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })
        }
        updates = parsed.data as Record<string, unknown>
      }
    } else {
      const body = await req.json()
      const parsed = DocumentSchema.partial().safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })
      }
      updates = parsed.data as Record<string, unknown>
    }

    // Always fetch current doc (needed for revision history + R2 key)
    const { data: current, error: currentErr } = await supabaseAdmin
      .from('documents')
      .select('file_url, file_name, file_size, mime_type, source_pdf_url, source_pdf_name, source_pdf_size, source_pdf_mime_type, word_url, word_name, word_size, pending_file_url, pending_file_name, pending_file_size, pending_file_mime, revision, type, description, owner_name, reviewer_name, approver_name, status, document_code, title, edit_date, effective_date, expiry_date, approved_at, published_at, approved_by_id, published_by_id, reviewer_id, approver_id, audience_text, cover_template_version, cover_generated_at, cover_metadata, imported_current_at, imported_current_by, imported_current_note, legacy_cover_included, obsolete_date')
      .eq('id', id)
      .single()

    if (currentErr) return NextResponse.json({ error: currentErr.message }, { status: 500 })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Enforce status transition rules server-side
    const requestedStatus = updates.status as string | undefined
    if (requestedStatus && current?.status && requestedStatus !== current.status) {
      if (newFile || fileKey || (newWordFile && newWordFile.size > 0) || wordFileKey) {
        return NextResponse.json({ error: 'การเปลี่ยนสถานะต้องทำแยกจากการอัปโหลดไฟล์' }, { status: 422 })
      }
      const invalidStatusField = Object.keys(updates).find((key) => !STATUS_CHANGE_INPUT_FIELDS.has(key))
      if (invalidStatusField) {
        return NextResponse.json({ error: `การเปลี่ยนสถานะไม่อนุญาตให้แก้ field ${invalidStatusField} พร้อมกัน` }, { status: 422 })
      }
      const allowed = allowedTransitions(current.status as DocStatus, actor.role, actor.doc_role ?? undefined)
      if (!allowed.includes(requestedStatus as DocStatus)) {
        return NextResponse.json({ error: 'สถานะที่เปลี่ยนไม่ได้รับอนุญาต' }, { status: 403 })
      }
      const incomingMemberships = await getActiveIncomingDocumentSetMemberships(id)
      const incomingBlocker = validateIncomingSetTransition(
        incomingMemberships,
        current.status,
        requestedStatus,
        'document',
      )
      if (incomingBlocker) {
        return NextResponse.json({
          error: `สถานะสมาชิกไม่ตรงกับชุดเอกสาร ${incomingBlocker.mainDocumentCode}: ${incomingBlocker.reason}`,
          blocker: incomingBlocker,
        }, { status: 422 })
      }
      if (['Review', 'Approved', 'Published'].includes(requestedStatus)) {
        const blocker = await getRegistrationSetTransitionBlocker(id, requestedStatus)
        if (blocker) {
          return NextResponse.json({
            error: `ยังเปลี่ยนสถานะเอกสารหลักไม่ได้: ${blocker.documentCode} — ${blocker.reason}`,
            blocker,
          }, { status: 422 })
        }
      }
    }

    if (current.status === 'Published') {
      if (newFile || fileKey || (newWordFile && newWordFile.size > 0) || wordFileKey) {
        return NextResponse.json({ error: 'เอกสาร Published ต้องสร้าง Revision ใหม่ก่อนเปลี่ยนไฟล์เนื้อหา' }, { status: 409 })
      }

      const requestedKeys = Object.keys(updates)
      const protectedKeys = new Set([
        'revision',
        'file_url',
        'file_name',
        'file_size',
        'mime_type',
        'source_pdf_url',
        'source_pdf_name',
        'source_pdf_size',
        'source_pdf_mime_type',
        'word_url',
        'word_name',
        'word_size',
        'pending_file_url',
        'pending_file_name',
        'pending_file_size',
        'pending_file_mime',
        'edit_date',
        'expiry_date',
        'effective_date',
        'approved_at',
        'published_at',
        'approved_by_id',
        'published_by_id',
        'imported_current_at',
        'imported_current_by',
        'imported_current_note',
        'legacy_cover_included',
      ])

      if (requestedKeys.some((key) => protectedKeys.has(key))) {
        return NextResponse.json({ error: 'เอกสาร Published ห้ามแก้ไฟล์, revision หรือวันที่ workflow โดยตรง' }, { status: 409 })
      }

      const metadataKeys = requestedKeys.filter((key) => key !== 'status' && key !== 'obsolete_date' && key !== 'obsolete_reason')
      if (metadataKeys.length > 0) {
        if (!canCorrectPublishedMetadata(actor)) {
          return NextResponse.json({ error: 'เฉพาะ Admin หรือ Document Controller เท่านั้นที่แก้ metadata ของ Published document ได้' }, { status: 403 })
        }
        const invalid = metadataKeys.find((key) => !isPublishedMetadataField(key))
        if (invalid) {
          return NextResponse.json({ error: `field ${invalid} ไม่อนุญาตให้แก้หลัง Published` }, { status: 422 })
        }
      }
    }

    const sourceUploadDate = ((newWordFile && newWordFile.size > 0) || wordFileKey) ? todayIsoDate() : undefined
    if (sourceUploadDate) {
      // Prefer the "วันที่แก้ไข/ทบทวน" value from the form; only default to today's date
      // when the form didn't supply one.
      if (typeof updates.edit_date !== 'string' || !updates.edit_date) updates.edit_date = sourceUploadDate
      if (typeof updates.expiry_date !== 'string' || !updates.expiry_date) updates.expiry_date = updates.edit_date
      if (!updates.owner_name && !current.owner_name && actor.name) updates.owner_name = actor.name
    } else if (typeof updates.edit_date === 'string' && !updates.expiry_date) {
      updates.expiry_date = updates.edit_date
    } else if (typeof updates.expiry_date === 'string' && !updates.edit_date) {
      updates.edit_date = updates.expiry_date
    }

    if (newFile || fileKey) {
      const fileSizeForCheck = newFile ? newFile.size : fileKeySizePre
      if (fileSizeForCheck && fileSizeForCheck > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 50 MB' }, { status: 422 })
      }

      const type = (updates.type as string) ?? current?.type ?? 'others'
      const fileRef = newFile ?? { name: fileKeyName ?? '', type: fileKeyType ?? '' }
      if (isCoverRequiredType(type) && !isPdfFile(fileRef)) {
        return NextResponse.json({ error: 'QP/WI ต้องใช้ PDF เนื้อหาในช่องไฟล์ทางการ' }, { status: 422 })
      }
      if (!isCoverRequiredType(type) && !isPdfFile(fileRef) && !isSourceFile(fileRef)) {
        return NextResponse.json({ error: 'ไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
      }

      let r2Key: string
      let uploadedSize: number
      let finalName: string
      let finalType: string

      if (newFile) {
        const headerMetadata: DocxHeaderMetadata = buildDocxHeaderMetadata({
          ...current,
          ...updates,
        })
        const uploaded = await uploadDocumentObject(newFile, type, '', headerMetadata)
        r2Key = uploaded.key
        uploadedSize = uploaded.size
        finalName = newFile.name
        finalType = newFile.type
      } else {
        // File was already uploaded directly to R2 via presigned URL. DOCX/XLSX header
        // metadata still gets patched — the unconditional patchTarget block below re-fetches
        // whatever updates.file_url ends up being and patches it in place either way.
        r2Key = fileKey as string
        finalName = fileKeyName ?? r2Key.split('/').pop() ?? 'file'
        finalType = fileKeyType ?? ''
        uploadedSize = fileKeySizePre && Number.isFinite(fileKeySizePre)
          ? fileKeySizePre
          : (await getStoredObjectSize(r2Key)) ?? 0
      }

      // Two different fallbacks on purpose, copied from the original code: mime_type
      // defaults to octet-stream, but source_pdf_mime_type (only set for cover-required
      // types, i.e. an already-validated PDF) defaults to application/pdf.
      updates.file_url  = r2Key
      updates.file_name = finalName
      updates.file_size = uploadedSize
      updates.mime_type = finalType || 'application/octet-stream'
      updates.pending_file_url = null
      updates.pending_file_name = null
      updates.pending_file_size = null
      updates.pending_file_mime = null
      if (current.pending_file_url && current.pending_file_url !== r2Key) {
        pendingFileKeyToDelete = current.pending_file_url
      }
      if (isCoverRequiredType(type)) {
        updates.source_pdf_url = r2Key
        updates.source_pdf_name = finalName
        updates.source_pdf_size = uploadedSize
        updates.source_pdf_mime_type = finalType || 'application/pdf'
      }
    }

    if (wordFileKey) {
      // File already uploaded directly to R2 via presigned URL — record the reference.
      if (wordFileName && !isSourceFile({ name: wordFileName })) {
        return NextResponse.json({ error: 'ไฟล์ต้นฉบับรองรับ DOC, DOCX, XLS, XLSX เท่านั้น' }, { status: 422 })
      }
      updates.word_url  = wordFileKey
      updates.word_name = wordFileName ?? wordFileKey.split('/').pop() ?? 'file'
      if (wordFileSizePre && Number.isFinite(wordFileSizePre)) updates.word_size = wordFileSizePre
      if (current.word_url && current.word_url !== wordFileKey) wordFileKeyToDelete = current.word_url
    } else if (newWordFile && newWordFile.size > 0) {
      if (newWordFile.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'ไฟล์ Word/Excel ใหญ่เกิน 50 MB' }, { status: 422 })
      }
      if (!isSourceFile(newWordFile)) {
        return NextResponse.json({ error: 'ไฟล์ต้นฉบับรองรับ DOC, DOCX, XLS, XLSX เท่านั้น' }, { status: 422 })
      }
      const type = (updates.type as string) ?? current?.type ?? 'others'
      const headerMetadata: DocxHeaderMetadata = buildDocxHeaderMetadata({
        ...current,
        ...updates,
      })
      const uploaded = await uploadDocumentObject(newWordFile, type, 'source-', headerMetadata)
      const wordKey = uploaded.key
      updates.word_url  = wordKey
      updates.word_name = newWordFile.name
      updates.word_size = uploaded.size
      if (current.word_url && current.word_url !== wordKey) wordFileKeyToDelete = current.word_url
    }

    // Save old revision to history when revision number changes OR file is replaced
    const skipRevision = req.nextUrl.searchParams.get('skipRevision') === '1'
    const revisionChanged = updates.revision !== undefined && updates.revision !== current?.revision
    if (!skipRevision && (revisionChanged || newFile || fileKey) && current?.file_url) {
      supabaseAdmin.from('document_revisions').insert({
        document_id:     id,
        revision_number: current.revision ?? '1',
        revision_note:   current.description ?? null,
        revised_by:      current.owner_name ?? null,
        approved_by:     current.approver_name ?? null,
        file_url:        current.file_url,
        file_name:       current.file_name ?? '',
        file_size:       current.file_size ?? null,
        mime_type:       current.mime_type ?? null,
        source_pdf_url:  current.source_pdf_url ?? null,
        source_pdf_name: current.source_pdf_name ?? null,
        source_pdf_size: current.source_pdf_size ?? null,
        source_pdf_mime_type: current.source_pdf_mime_type ?? null,
        word_url:        current.word_url ?? null,
        word_name:       current.word_name ?? null,
        word_size:       current.word_size ?? null,
        edit_date:       current.edit_date ?? null,
        effective_date:  current.effective_date ?? null,
        expiry_date:     current.expiry_date ?? null,
        approved_at:     current.approved_at ?? null,
        published_at:    current.published_at ?? null,
        approved_by_id:  current.approved_by_id ?? null,
        published_by_id: current.published_by_id ?? null,
        reviewer_id:     current.reviewer_id ?? null,
        approver_id:     current.approver_id ?? null,
        audience_text:   current.audience_text ?? null,
        cover_template_version: current.cover_template_version ?? null,
        cover_generated_at: current.cover_generated_at ?? null,
        cover_metadata:  current.cover_metadata ?? null,
        imported_current_at: current.imported_current_at ?? null,
        imported_current_by: current.imported_current_by ?? null,
        imported_current_note: current.imported_current_note ?? null,
        legacy_cover_included: current.legacy_cover_included ?? false,
        uploaded_by:     actor.id,
      }).then(undefined, () => {})
    }

    // Auto-set obsolete_date when transitioning to Obsolete; clear when leaving Obsolete
    const newStatus = (updates as Record<string, unknown>).status
    if (newStatus === 'Obsolete') {
      if (!(updates as Record<string, unknown>).obsolete_date) {
        (updates as Record<string, unknown>).obsolete_date = new Date().toISOString().split('T')[0]
      }
    } else if (newStatus && newStatus !== 'Obsolete') {
      (updates as Record<string, unknown>).obsolete_date   = null
      ;(updates as Record<string, unknown>).obsolete_reason = null
    }

    const targetStatus = (typeof newStatus === 'string' ? newStatus : current.status) as string
    const targetType = ((updates.type as string | undefined) ?? current.type) as string
    const workflowCheck = canMoveToStatus(
      {
        type: targetType,
        status: current.status,
        file_url: (updates.file_url as string | null | undefined) ?? current.file_url ?? null,
        source_pdf_url: (updates.source_pdf_url as string | null | undefined) ?? current.source_pdf_url ?? null,
        word_url: (updates.word_url as string | null | undefined) ?? current.word_url ?? null,
      },
      targetStatus,
    )
    if (!workflowCheck.ok) {
      return NextResponse.json({ error: workflowCheck.error }, { status: 422 })
    }

    if (typeof newStatus === 'string' && newStatus !== current.status) {
      if (newStatus === 'Approved') {
        updates.approved_at = new Date().toISOString()
        updates.approved_by_id = actor.id
        if (!updates.reviewer_id && !current.reviewer_id) updates.reviewer_id = actor.id
        if (!updates.reviewer_name && !current.reviewer_name && actor.name) updates.reviewer_name = actor.name
      }
      if (newStatus === 'Published') {
        const now = new Date().toISOString()
        updates.published_at = now
        updates.published_by_id = actor.id
        if (!updates.effective_date && !current.effective_date) {
          updates.effective_date = now.split('T')[0]
        }
      }
    }

    if (current.status !== 'Published') {
      const finalHeaderMetadata: DocxHeaderMetadata = buildDocxHeaderMetadata({
        ...current,
        ...updates,
      })
      const patchedKeys = new Set<string>()
      const patchTarget = async (key: string | null | undefined, name: string | null | undefined, sizeField: 'file_size' | 'word_size') => {
        if (!key || patchedKeys.has(key)) return
        const fileRef = { name: name ?? '' }
        const canPatchDocx = isDocxFile(fileRef)
        const canPatchXlsx = isXlsxFile(fileRef)
        if (!canPatchDocx && !canPatchXlsx) return
        patchedKeys.add(key)
        let patchedSize: number | null = null
        try {
          patchedSize = canPatchDocx
            ? await patchR2DocxObject(key, finalHeaderMetadata)
            : await patchR2XlsxObject(key, finalHeaderMetadata)
        } catch (err) {
          console.warn('Skipping document source metadata patch', {
            key,
            name,
            error: toMsg(err),
          })
          return
        }
        if (patchedSize !== null) updates[sizeField] = patchedSize
      }

      await patchTarget(
        (updates.word_url as string | null | undefined) ?? current.word_url,
        (updates.word_name as string | null | undefined) ?? current.word_name,
        'word_size',
      )
      await patchTarget(
        (updates.file_url as string | null | undefined) ?? current.file_url,
        (updates.file_name as string | null | undefined) ?? current.file_name,
        'file_size',
      )
    }

    const publishedMetadataFields = Object.keys(updates).filter((key) => isPublishedMetadataField(key))
    const isPublishedCorrectionRequest = current.status === 'Published'
      && targetStatus === 'Published'
      && publishedMetadataFields.length > 0
    const publishedCoverMetadataChanged = current.status === 'Published'
      && targetStatus === 'Published'
      && publishedMetadataFields.some((key) => isPublishedCoverMetadataField(key))
    const shouldBuildFinalPdf = COVER_GENERATION_ENABLED
      && isCoverRequiredType(targetType)
      && !current.legacy_cover_included
      && (newStatus === 'Published' || publishedCoverMetadataChanged)
    // While system cover generation is suspended, a fresh QP/WI Rev.00 becoming Published has
    // no cover page at all — stamp a footer + append the revision-history page directly onto
    // the uploaded content PDF instead, mirroring the "PDF already has a cover" flow.
    const shouldStampFooterOnly = !COVER_GENERATION_ENABLED
      && isCoverRequiredType(targetType)
      && !current.legacy_cover_included
      && newStatus === 'Published'
    let finalPdfBuilt = false
    let footerStamped = false
    if (shouldBuildFinalPdf) {
      try {
        const { buildPublishedPdfFields } = await import('@/lib/documents/publish')
        const finalFields = await buildPublishedPdfFields(id, {
          ...updates,
          type: targetType,
          file_url: (updates.file_url as string | null | undefined) ?? current.file_url,
          source_pdf_url: (updates.source_pdf_url as string | null | undefined) ?? current.source_pdf_url,
        })
        if (finalFields) {
          Object.assign(updates, finalFields)
          finalPdfBuilt = true
        }
      } catch (err) {
        if (current.status !== 'Published') throw err
        console.error('Published document cover regeneration failed; saving metadata only', {
          documentId: id,
          code: current.document_code,
          error: toMsg(err),
        })
        warnings.push('บันทึกข้อมูลแล้ว แต่สร้าง PDF หน้าปกใหม่ไม่สำเร็จ กรุณาลอง Regenerate cover อีกครั้ง')
      }
    } else if (shouldStampFooterOnly) {
      try {
        const contentKey = (updates.file_url as string | null | undefined) ?? current.file_url
        const effectiveDate = parseDateOnly((updates.effective_date as string | null | undefined) ?? current.effective_date)
        if (contentKey && effectiveDate) {
          const contentBytes = await getObjectBuffer(contentKey)
          const stamped = await stampPublishedPdfFooter(
            contentBytes,
            current.document_code,
            (updates.revision as string | null | undefined) ?? current.revision,
            effectiveDate,
            { stampFirstPage: true },
          )
          const { appendRevisionHistoryPdf, generateRevisionHistoryPdfForDocument } = await import('@/lib/documents/revision-history-pdf')
          const historyPdf = await generateRevisionHistoryPdfForDocument(id, { ...updates, type: targetType })
          const finalPdf = await appendRevisionHistoryPdf(stamped, historyPdf)
          const safeCode = current.document_code.replace(/[^a-zA-Z0-9._-]/g, '_')
          const stampedKey = `documents/generated/${id}/${Date.now()}-${safeCode}-final.pdf`
          await r2.send(new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: stampedKey,
            Body: Buffer.from(finalPdf),
            ContentType: 'application/pdf',
          }))
          updates.file_url = stampedKey
          updates.file_size = finalPdf.length
          updates.mime_type = 'application/pdf'
          footerStamped = true
        }
      } catch (err) {
        console.error('Published document footer stamp failed; saving metadata only', {
          documentId: id,
          code: current.document_code,
          error: toMsg(err),
        })
        warnings.push('บันทึกข้อมูลแล้ว แต่ stamp footer และ revision history ลง PDF ไม่สำเร็จ')
      }
    }

    // ISO 15189 8.3: bake an OBSOLETE watermark into the official PDF so a downloaded copy
    // can't be mistaken for the in-force version. Office files are left untouched.
    // Obsolete is terminal, but the pre-stamp key is kept in cover_metadata for recovery.
    const currentFileIsPdf = current.mime_type === 'application/pdf'
      || /\.pdf$/i.test((current.file_name as string | null) ?? (current.file_url as string | null) ?? '')
    if (newStatus === 'Obsolete' && current.status !== 'Obsolete' && current.file_url && currentFileIsPdf) {
      try {
        const { stampObsoleteWatermark } = await import('@/lib/documents/obsolete-stamp')
        const obsoleteDateIso = String((updates as Record<string, unknown>).obsolete_date ?? current.obsolete_date ?? '')
        const dateText = obsoleteDateIso
          ? new Date(obsoleteDateIso + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
          : ''
        const stamped = await stampObsoleteWatermark(await getObjectBuffer(current.file_url), dateText)
        const safeCode = current.document_code.replace(/[^a-zA-Z0-9._-]/g, '_')
        const obsoleteKey = `documents/generated/${id}/${Date.now()}-${safeCode}-obsolete.pdf`
        await r2.send(new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: obsoleteKey,
          Body: Buffer.from(stamped),
          ContentType: 'application/pdf',
        }))
        updates.file_url = obsoleteKey
        updates.file_size = stamped.length
        updates.mime_type = 'application/pdf'
        updates.cover_metadata = {
          ...((current.cover_metadata as Record<string, unknown> | null) ?? {}),
          pre_obsolete_file_url: current.file_url,
        }
        supabaseAdmin.from('audit_log').insert({
          action: 'document.obsolete_stamp',
          user_id: actor.id,
          target: current.document_code ?? id,
          detail: `stamped OBSOLETE watermark · ${obsoleteDateIso}`,
        }).then(undefined, () => {})
      } catch (err) {
        console.error('Obsolete watermark stamp failed; status change saved without it', {
          documentId: id,
          code: current.document_code,
          error: toMsg(err),
        })
        warnings.push('เปลี่ยนสถานะแล้ว แต่ stamp ลายน้ำยกเลิกใช้งานลง PDF ไม่สำเร็จ')
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะอัปเดต' }, { status: 422 })
    }

    const { data: doc, error: dbErr } = await supabaseAdmin
      .from('documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    if (pendingFileKeyToDelete) {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: pendingFileKeyToDelete }))
        .catch(() => {})
    }

    if (wordFileKeyToDelete) {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: wordFileKeyToDelete }))
        .catch(() => {})
    }

    if (doc.status === 'Published') {
      try {
        await purgeEphemeralAttachments(id)
      } catch (err) {
        console.error('Published document ephemeral attachment purge failed', {
          documentId: id,
          code: current.document_code,
          error: toMsg(err),
        })
        warnings.push('เผยแพร่แล้ว แต่ลบไฟล์แนบชั่วคราวไม่สำเร็จ')
      }
    }

    if (typeof newStatus === 'string' && newStatus !== current?.status) {
      supabaseAdmin.from('document_status_history')
        .insert({
          document_id: id,
          from_status: current?.status ?? null,
          to_status: newStatus,
          changed_by: actor.id,
        })
        .then(undefined, () => {})
    }

    supabaseAdmin.from('document_access_logs')
      .insert({ document_id: id, user_id: actor.id, action: 'edit' })
      .then(undefined, () => {})

    const auditAction = (typeof newStatus === 'string' && newStatus !== current?.status) ? 'document.status_change' : 'document.edit'
    const auditDetail = auditAction === 'document.status_change'
      ? `${doc.document_code} · ${current?.status ?? '?'} → ${newStatus}`
      : isPublishedCorrectionRequest
        ? `${doc.document_code} · published metadata: ${publishedMetadataFields.join(', ')}`
      : `${doc.document_code} · ${doc.title}`
    supabaseAdmin.from('audit_log').insert({
      action: auditAction,
      user_id: actor.id,
      target: doc.document_code,
      detail: auditDetail,
    }).then(undefined, () => {})

    if (finalPdfBuilt) {
      supabaseAdmin.from('audit_log').insert({
        action: current.status === 'Published' ? 'document.cover_regenerate' : 'document.cover_generate',
        user_id: actor.id,
        target: doc.document_code,
        detail: current.status === 'Published'
          ? `${doc.document_code} · cover metadata: ${publishedMetadataFields.filter(isPublishedCoverMetadataField).join(', ')}`
          : `${doc.document_code} · ${doc.title}`,
      }).then(undefined, () => {})
    }

    if (footerStamped) {
      supabaseAdmin.from('audit_log').insert({
        action: 'document.footer_stamp',
        user_id: actor.id,
        target: doc.document_code,
        detail: `${doc.document_code} · ${doc.title}`,
      }).then(undefined, () => {})
    }

    if (warnings.length > 0) {
      return NextResponse.json({ ...doc, warnings })
    }
    return NextResponse.json(doc)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canDeleteDocument(actor.role, actor.doc_role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const activeSet = await findActiveRegistrationSet(id)
    if (activeSet) {
      return NextResponse.json({
        error: `เอกสารนี้เป็นสมาชิกของชุด ${activeSet.document_code} (สถานะ ${activeSet.status}) กรุณาลบผ่านเอกสารหลักของชุดแทน`,
      }, { status: 409 })
    }

    const now = new Date().toISOString()
    const activeSetAsMain = await findActiveSetAsMain(id)
    const deletedMemberCodes: string[] = []

    if (activeSetAsMain) {
      for (const link of activeSetAsMain.links) {
        if (link.set_mode === 'registered') {
          // Created only for this set — has no life outside it, so it's deleted with the main.
          const { data: memberDoc } = await supabaseAdmin
            .from('documents')
            .update({ deleted_at: now })
            .eq('id', link.linked_doc_id)
            .is('deleted_at', null)
            .select('document_code')
            .maybeSingle()
          if (memberDoc) deletedMemberCodes.push(memberDoc.document_code)
        } else if (link.set_mode === 'revision' && link.set_draft_id) {
          // Member is an existing Published document — only its owned working-revision draft
          // is cancelled; the Published document itself is untouched.
          await supabaseAdmin
            .from('document_revision_drafts')
            .update({ cancelled_at: now, cancelled_by: actor.id, cancel_reason: 'main document of set deleted' })
            .eq('id', link.set_draft_id)
            .is('cancelled_at', null)
        }
        // 'linked' mode members are independent Published documents merely referenced by the
        // set — nothing to touch on the document itself, just drop the link below.
      }

      const linksDeleteErr = (await supabaseAdmin
        .from('document_links')
        .delete()
        .eq('document_id', id)
        .eq('link_kind', 'set')).error
      if (linksDeleteErr) return NextResponse.json({ error: linksDeleteErr.message }, { status: 500 })
    }

    const { data: deletedDoc, error: dbErr } = await supabaseAdmin
      .from('documents')
      .update({ deleted_at: now })
      .eq('id', id)
      .select('document_code, title')
      .single()

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    supabaseAdmin.from('document_access_logs')
      .insert({ document_id: id, user_id: actor.id, action: 'delete' })
      .then(undefined, () => {})

    supabaseAdmin.from('audit_log').insert({
      action: activeSetAsMain ? 'document.delete_set' : 'document.delete',
      user_id: actor.id,
      target: deletedDoc?.document_code ?? id,
      detail: activeSetAsMain
        ? `${deletedDoc?.document_code} · ${deletedDoc?.title} · ลบทั้งชุด (เอกสารสนับสนุน ${deletedMemberCodes.length} ฉบับ: ${deletedMemberCodes.join(', ') || '-'})`
        : (deletedDoc ? `${deletedDoc.document_code} · ${deletedDoc.title}` : id),
    }).then(undefined, () => {})

    return NextResponse.json({ ok: true, deletedSet: Boolean(activeSetAsMain), deletedMemberCodes })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
