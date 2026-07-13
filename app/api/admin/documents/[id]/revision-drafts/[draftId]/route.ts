import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requiredEnv } from '@/lib/env'
import { getActor, canAccessDocuments, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { allowedTransitions, type DocStatus } from '@/lib/documents/transitions'
import { DocumentSchema } from '@/lib/validations/document'
import { canMoveToStatus, COVER_GENERATION_ENABLED, isCoverRequiredType, isPdfFile, isSourceFile } from '@/lib/documents/workflow'
import { isDocxFile, patchDocxHeaderMetadata, type DocxHeaderMetadata } from '@/lib/documents/docx-header'
import { isXlsxFile, patchXlsxHeaderMetadata } from '@/lib/documents/xlsx-header'
import { buildDocxHeaderMetadata } from '@/lib/documents/metadata'
import { stampPublishedPdfFooter } from '@/lib/documents/date-inject'
import { archiveCurrentRevision } from '@/lib/documents/revisions'
import type { Document } from '@/lib/supabase/types'
import { validateIncomingSetTransition } from '@/lib/documents/registration-set-contracts'
import { getActiveOwnedRevisionSetMemberships } from '@/lib/documents/active-registration-sets'

type Params = { params: Promise<{ id: string; draftId: string }> }
const STATUS_CHANGE_INPUT_FIELDS = new Set(['status', 'obsolete_reason'])
const MAX_DRAFT_FILE_SIZE = 50 * 1024 * 1024
let cachedR2: S3Client | null = null

type UploadedDraftFile = {
  kind: 'official' | 'source'
  key: string
  fileName: string
  fileType: string
  fileSize: number
}

function toMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

function getR2Bucket() {
  return requiredEnv('R2_BUCKET_NAME')
}

function getR2Client() {
  if (!cachedR2) {
    cachedR2 = new S3Client({
      region: 'auto',
      endpoint: `https://${requiredEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY'),
      },
    })
  }
  return cachedR2
}

function canSkipSystemCover(actor: { role: string; doc_role?: string | null }) {
  return actor.role === 'Admin'
    || actor.role === 'Quality Manager'
    || actor.role === 'Laboratory Director'
    || actor.doc_role === 'Quality Manager'
    || actor.doc_role === 'Laboratory Director'
}

function canManageDraftOfficialFile(actor: { role: string; doc_role?: string | null }) {
  return actor.role === 'Admin' || actor.role === 'Document Controller' || actor.doc_role === 'Document Controller'
}

function safeStorageName(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function inferredContentType(filename: string, contentType: string | null | undefined) {
  if (contentType?.trim()) return contentType.trim()
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'doc') return 'application/msword'
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === 'xls') return 'application/vnd.ms-excel'
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return 'application/octet-stream'
}

function parseUploadedDraftFile(value: unknown): UploadedDraftFile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const kind = raw.kind === 'official' || raw.kind === 'source' ? raw.kind : null
  const key = typeof raw.key === 'string' ? raw.key : ''
  const fileName = typeof raw.fileName === 'string' ? raw.fileName : ''
  const fileType = inferredContentType(fileName, typeof raw.fileType === 'string' ? raw.fileType : null)
  const fileSize = typeof raw.fileSize === 'number' ? raw.fileSize : Number(raw.fileSize)
  if (!kind || !key || !fileName || !Number.isFinite(fileSize)) return null
  return { kind, key, fileName, fileType, fileSize }
}

function validateDraftFile(
  kind: 'official' | 'source',
  file: { name?: string; type?: string; size?: number },
  docType: string,
  actor: { role: string; doc_role?: string | null },
) {
  if (file.size !== undefined && file.size > MAX_DRAFT_FILE_SIZE) {
    return kind === 'source' ? 'ไฟล์ต้นฉบับใหญ่เกิน 50 MB' : 'ไฟล์ทางการใหญ่เกิน 50 MB'
  }
  if (kind === 'source') {
    return isSourceFile(file) ? null : 'ไฟล์ต้นฉบับรองรับ DOC, DOCX, XLS, XLSX เท่านั้น'
  }
  if (!canManageDraftOfficialFile(actor)) {
    return 'เฉพาะ Admin หรือ Document Controller เท่านั้นที่อัปโหลด PDF เนื้อหา/ไฟล์ทางการได้'
  }
  if (isCoverRequiredType(docType) && !isPdfFile(file)) {
    return 'QP/WI ต้องใช้ PDF เนื้อหาในช่องไฟล์ทางการ'
  }
  if (!isCoverRequiredType(docType) && !isPdfFile(file) && !isSourceFile(file)) {
    return 'ไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX'
  }
  return null
}

async function uploadDocumentObject(file: File, type: string, prefix = '', headerMetadata?: DocxHeaderMetadata) {
  const year = new Date().getFullYear()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const r2Key = `documents/${type.toLowerCase()}/${year}/${Date.now()}-${prefix}${safeName}`
  let body: Buffer<ArrayBufferLike> = Buffer.from(await file.arrayBuffer())
  if (headerMetadata) {
    try {
      if (isDocxFile(file)) {
        body = await patchDocxHeaderMetadata(body, headerMetadata)
      } else if (isXlsxFile(file)) {
        body = await patchXlsxHeaderMetadata(body, headerMetadata)
      }
    } catch (err) {
      console.warn('Skipping draft source metadata patch during upload', {
        fileName: file.name,
        error: toMsg(err),
      })
    }
  }
  await getR2Client().send(new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: r2Key,
    Body: body,
    ContentType: file.type || 'application/octet-stream',
  }))
  return { key: r2Key, size: body.length }
}

async function getObjectBuffer(key: string) {
  const object = await getR2Client().send(new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }))
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

async function patchR2DocxObject(key: string, metadata: DocxHeaderMetadata) {
  const original = await getObjectBuffer(key)
  const patched = await patchDocxHeaderMetadata(original, metadata)
  if (patched.equals(original)) return null
  await getR2Client().send(new PutObjectCommand({
    Bucket: getR2Bucket(),
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
  await getR2Client().send(new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
    Body: patched,
    ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }))
  return patched.length
}

async function getStoredObjectSize(key: string) {
  const object = await getR2Client().send(new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key }))
  return object.ContentLength ?? null
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

export async function POST(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!(await canAccessDocuments(actor, 'edit'))) return jsonForbidden()
  const { id, draftId } = await params

  try {
    const body = await req.json() as Record<string, unknown>
    const kind = body.kind === 'official' || body.kind === 'source' ? body.kind : null
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : ''
    const fileType = inferredContentType(fileName, typeof body.fileType === 'string' ? body.fileType : null)
    const fileSize = typeof body.fileSize === 'number' ? body.fileSize : Number(body.fileSize)
    if (!kind || !fileName || !Number.isFinite(fileSize)) {
      return NextResponse.json({ error: 'ข้อมูลไฟล์ไม่ครบ' }, { status: 422 })
    }

    const { data: draft, error: draftErr } = await supabaseAdmin
      .from('document_revision_drafts')
      .select('id, type, status')
      .eq('id', draftId)
      .eq('document_id', id)
      .is('cancelled_at', null)
      .single()
    if (draftErr || !draft) return NextResponse.json({ error: draftErr?.message ?? 'Draft not found' }, { status: 404 })
    if (draft.status === 'Published') return NextResponse.json({ error: 'Revision draft นี้ถูก Published แล้ว' }, { status: 409 })

    const validationError = validateDraftFile(kind, { name: fileName, type: fileType, size: fileSize }, draft.type, actor)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 422 })

    const year = new Date().getFullYear()
    const prefix = kind === 'official' ? 'draft-official-' : 'draft-source-'
    const key = `documents/${String(draft.type).toLowerCase()}/${year}/${Date.now()}-${prefix}${safeStorageName(fileName)}`
    const uploadUrl = await getSignedUrl(
      getR2Client(),
      new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, ContentType: fileType }),
      { expiresIn: 300 },
    )

    return NextResponse.json({ uploadMode: 'direct-r2', uploadUrl, key, contentType: fileType })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!(await canAccessDocuments(actor, 'edit'))) return jsonForbidden()
  const { id, draftId } = await params

  try {
    const sp = req.nextUrl.searchParams
    if (sp.get('intent') !== 'upload') {
      return NextResponse.json({ error: 'Unsupported intent' }, { status: 405 })
    }
    const kind = sp.get('kind') === 'official' || sp.get('kind') === 'source' ? sp.get('kind') as 'official' | 'source' : null
    const fileName = (sp.get('fileName') ?? '').trim()
    const fileType = inferredContentType(fileName, sp.get('fileType'))
    const fileSize = Number(sp.get('fileSize') ?? '')
    if (!kind || !fileName || !Number.isFinite(fileSize)) {
      return NextResponse.json({ error: 'ข้อมูลไฟล์ไม่ครบ' }, { status: 422 })
    }

    const { data: draft, error: draftErr } = await supabaseAdmin
      .from('document_revision_drafts')
      .select('id, type, status')
      .eq('id', draftId)
      .eq('document_id', id)
      .is('cancelled_at', null)
      .single()
    if (draftErr || !draft) return NextResponse.json({ error: draftErr?.message ?? 'Draft not found' }, { status: 404 })
    if (draft.status === 'Published') return NextResponse.json({ error: 'Revision draft นี้ถูก Published แล้ว' }, { status: 409 })

    const validationError = validateDraftFile(kind, { name: fileName, type: fileType, size: fileSize }, draft.type, actor)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 422 })

    const year = new Date().getFullYear()
    const prefix = kind === 'official' ? 'draft-official-' : 'draft-source-'
    const key = `documents/${String(draft.type).toLowerCase()}/${year}/${Date.now()}-${prefix}${safeStorageName(fileName)}`
    const uploadUrl = await getSignedUrl(
      getR2Client(),
      new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, ContentType: fileType }),
      { expiresIn: 300 },
    )

    return NextResponse.json({ uploadMode: 'direct-r2', uploadUrl, key, contentType: fileType })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!(await canAccessDocuments(actor, 'edit'))) return jsonForbidden()
  const { id, draftId } = await params

  try {
    const { data: draft, error: draftErr } = await supabaseAdmin
      .from('document_revision_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('document_id', id)
      .is('cancelled_at', null)
      .single()

    if (draftErr || !draft) return NextResponse.json({ error: draftErr?.message ?? 'Draft not found' }, { status: 404 })
    if (draft.status === 'Published') return NextResponse.json({ error: 'Revision draft นี้ถูก Published แล้ว' }, { status: 409 })

    const { data: parentDoc } = await supabaseAdmin
      .from('documents')
      .select('document_code, file_url, word_url, description')
      .eq('id', id)
      .single()
    if (!parentDoc) return NextResponse.json({ error: 'Current document not found' }, { status: 404 })

    const contentType = req.headers.get('content-type') ?? ''
    let updates: Record<string, unknown> = {}
    let officialFile: File | null = null
    let sourceFile: File | null = null
    let uploadedFile: UploadedDraftFile | null = null
    let skipSystemCover = false
    let removePortalRevisionHistory = true

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const officialRaw = form.get('file')
      officialFile = officialRaw instanceof File && officialRaw.size > 0 ? officialRaw : null
      const sourceRaw = form.get('word_file')
      sourceFile = sourceRaw instanceof File && sourceRaw.size > 0 ? sourceRaw : null
      const metaRaw = form.get('meta')
      if (metaRaw) {
        const rawMeta = JSON.parse(metaRaw as string) as Record<string, unknown>
        skipSystemCover = rawMeta.skip_system_cover === true
        removePortalRevisionHistory = rawMeta.remove_portal_revision_history !== false
        const parsed = DocumentSchema.partial().safeParse(rawMeta)
        if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })
        updates = parsed.data as Record<string, unknown>
      }
    } else {
      const rawBody = await req.json() as Record<string, unknown>
      skipSystemCover = rawBody.skip_system_cover === true
      removePortalRevisionHistory = rawBody.remove_portal_revision_history !== false
      uploadedFile = parseUploadedDraftFile(rawBody.uploaded_file)
      const parsed = DocumentSchema.partial().safeParse(rawBody)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })
      updates = parsed.data as Record<string, unknown>
    }

    const nextStatus = updates.status as string | undefined
    if (nextStatus && nextStatus !== draft.status) {
      if (officialFile || sourceFile) {
        return NextResponse.json({ error: 'การเปลี่ยนสถานะต้องทำแยกจากการอัปโหลดไฟล์' }, { status: 422 })
      }
      const invalidStatusField = Object.keys(updates).find((key) => !STATUS_CHANGE_INPUT_FIELDS.has(key))
      if (invalidStatusField) {
        return NextResponse.json({ error: `การเปลี่ยนสถานะไม่อนุญาตให้แก้ field ${invalidStatusField} พร้อมกัน` }, { status: 422 })
      }
      if (skipSystemCover && nextStatus !== 'Published') {
        return NextResponse.json({ error: 'การข้ามหน้าปกระบบใช้ได้เฉพาะตอน Published เท่านั้น' }, { status: 422 })
      }
      const allowed = allowedTransitions(draft.status as DocStatus, actor.role, actor.doc_role ?? undefined)
      if (!allowed.includes(nextStatus as DocStatus)) {
        return NextResponse.json({ error: 'สถานะที่เปลี่ยนไม่ได้รับอนุญาต' }, { status: 403 })
      }
      const incomingMemberships = await getActiveOwnedRevisionSetMemberships(draftId)
      const incomingBlocker = validateIncomingSetTransition(
        incomingMemberships,
        draft.status,
        nextStatus,
        'revision-draft',
        draftId,
      )
      if (incomingBlocker) {
        return NextResponse.json({
          error: `สถานะ revision draft ไม่ตรงกับชุดเอกสาร ${incomingBlocker.mainDocumentCode}: ${incomingBlocker.reason}`,
          blocker: incomingBlocker,
        }, { status: 422 })
      }
    }

    const targetType = ((updates.type as string | undefined) ?? draft.type) as string
    const sourceUploadDate = sourceFile || uploadedFile?.kind === 'source' ? todayIsoDate() : undefined
    if (sourceUploadDate) {
      if (updates.edit_date === undefined && !draft.edit_date) updates.edit_date = sourceUploadDate
      if (updates.expiry_date === undefined && !draft.expiry_date) updates.expiry_date = sourceUploadDate
      if (!updates.owner_name && !draft.owner_name && actor.name) updates.owner_name = actor.name
    }

    if (officialFile) {
      if (!canManageDraftOfficialFile(actor)) {
        return NextResponse.json({ error: 'เฉพาะ Admin หรือ Document Controller เท่านั้นที่อัปโหลด PDF เนื้อหา/ไฟล์ทางการได้' }, { status: 403 })
      }
      if (officialFile.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'ไฟล์ทางการใหญ่เกิน 50 MB' }, { status: 422 })
      if (isCoverRequiredType(targetType) && !isPdfFile(officialFile)) {
        return NextResponse.json({ error: 'QP/WI ต้องใช้ PDF เนื้อหาในช่องไฟล์ทางการ' }, { status: 422 })
      }
      if (!isCoverRequiredType(targetType) && !isPdfFile(officialFile) && !isSourceFile(officialFile)) {
        return NextResponse.json({ error: 'ไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
      }
      const headerMetadata: DocxHeaderMetadata = buildDocxHeaderMetadata({
        ...draft,
        ...updates,
        document_code: parentDoc.document_code,
      })
      const uploaded = await uploadDocumentObject(officialFile, targetType, 'draft-official-', headerMetadata)
      const key = uploaded.key
      updates.file_url = key
      updates.file_name = officialFile.name
      updates.file_size = uploaded.size
      updates.mime_type = officialFile.type || 'application/octet-stream'
      if (isCoverRequiredType(targetType)) {
        updates.source_pdf_url = key
        updates.source_pdf_name = officialFile.name
        updates.source_pdf_size = uploaded.size
        updates.source_pdf_mime_type = officialFile.type || 'application/pdf'
      }
    }

    if (sourceFile) {
      if (sourceFile.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'ไฟล์ต้นฉบับใหญ่เกิน 50 MB' }, { status: 422 })
      if (!isSourceFile(sourceFile)) return NextResponse.json({ error: 'ไฟล์ต้นฉบับรองรับ DOC, DOCX, XLS, XLSX เท่านั้น' }, { status: 422 })
      const headerMetadata: DocxHeaderMetadata = buildDocxHeaderMetadata({
        ...draft,
        ...updates,
        document_code: parentDoc.document_code,
      })
      const uploaded = await uploadDocumentObject(sourceFile, targetType, 'draft-source-', headerMetadata)
      const key = uploaded.key
      updates.word_url = key
      updates.word_name = sourceFile.name
      updates.word_size = uploaded.size
      if (draft.description && draft.description === parentDoc.description && updates.description === undefined) {
        updates.description = ''
      }
    }

    if (uploadedFile) {
      const validationError = validateDraftFile(
        uploadedFile.kind,
        { name: uploadedFile.fileName, type: uploadedFile.fileType, size: uploadedFile.fileSize },
        targetType,
        actor,
      )
      if (validationError) return NextResponse.json({ error: validationError }, { status: 422 })
      if (!uploadedFile.key.startsWith(`documents/${targetType.toLowerCase()}/`)) {
        return NextResponse.json({ error: 'key ไฟล์ไม่ถูกต้อง' }, { status: 422 })
      }
      const storedSize = await getStoredObjectSize(uploadedFile.key).catch(() => null)
      if (storedSize === null) return NextResponse.json({ error: 'ไม่พบไฟล์ที่อัปโหลดใน storage' }, { status: 422 })
      if (storedSize > MAX_DRAFT_FILE_SIZE) {
        return NextResponse.json({ error: uploadedFile.kind === 'source' ? 'ไฟล์ต้นฉบับใหญ่เกิน 50 MB' : 'ไฟล์ทางการใหญ่เกิน 50 MB' }, { status: 422 })
      }
      if (uploadedFile.kind === 'official') {
        updates.file_url = uploadedFile.key
        updates.file_name = uploadedFile.fileName
        updates.file_size = storedSize
        updates.mime_type = uploadedFile.fileType || 'application/octet-stream'
        if (isCoverRequiredType(targetType)) {
          updates.source_pdf_url = uploadedFile.key
          updates.source_pdf_name = uploadedFile.fileName
          updates.source_pdf_size = storedSize
          updates.source_pdf_mime_type = uploadedFile.fileType || 'application/pdf'
        }
      } else {
        updates.word_url = uploadedFile.key
        updates.word_name = uploadedFile.fileName
        updates.word_size = storedSize
        if (draft.description && draft.description === parentDoc.description && updates.description === undefined) {
          updates.description = ''
        }
      }
    }

    const statusAfter = (nextStatus ?? draft.status) as string

    // Only DCC/Admin may publish a revision draft — Reviewers can prepare and move a draft up
    // to Approved, but the final "go live" step (which archives the current revision and
    // promotes the draft onto the live document) is reserved for DCC/Admin.
    if (nextStatus === 'Published' && nextStatus !== draft.status) {
      const canPublish = actor.role === 'Admin'
        || actor.role === 'Document Controller'
        || actor.doc_role === 'Document Controller'
      if (!canPublish) {
        return NextResponse.json({ error: 'เฉพาะ DCC หรือ Admin เท่านั้นที่เผยแพร่เอกสารได้' }, { status: 403 })
      }
    }

    if (nextStatus && nextStatus !== draft.status) {
      const workflowCheck = canMoveToStatus({
        type: targetType,
        file_url: (updates.file_url as string | null | undefined) ?? draft.file_url ?? null,
        source_pdf_url: (updates.source_pdf_url as string | null | undefined) ?? draft.source_pdf_url ?? null,
        word_url: (updates.word_url as string | null | undefined) ?? draft.word_url ?? null,
      }, statusAfter)
      if (!workflowCheck.ok) return NextResponse.json({ error: workflowCheck.error }, { status: 422 })
    }

    if (nextStatus && nextStatus !== draft.status) {
      if (nextStatus === 'Approved') {
        updates.approved_at = new Date().toISOString()
        updates.approved_by_id = actor.id
        if (!updates.reviewer_id && !draft.reviewer_id) updates.reviewer_id = actor.id
        if (!updates.reviewer_name && !draft.reviewer_name && actor.name) updates.reviewer_name = actor.name
      }
      if (nextStatus === 'Published') {
        const now = new Date().toISOString()
        updates.published_at = now
        updates.published_by_id = actor.id
        if (!updates.effective_date && !draft.effective_date) updates.effective_date = now.split('T')[0]
      }
    }

    const merged = { ...draft, ...updates }
    // While system cover generation is suspended, every QP/WI revision publish behaves like
    // "PDF already has a cover" (footer stamp + revision-history append onto the uploaded
    // content PDF, no system cover built) — mirrors the Rev.00 shouldStampFooterOnly path in
    // [id]/route.ts. The user-facing skip-cover checkbox only matters once cover generation is
    // re-enabled, where it becomes an explicit opt-out from system cover generation.
    const userSkippedCover = Boolean(skipSystemCover && statusAfter === 'Published' && isCoverRequiredType(merged.type))
    const publishWithExistingCover = Boolean(
      statusAfter === 'Published' && isCoverRequiredType(merged.type) && (!COVER_GENERATION_ENABLED || skipSystemCover),
    )
    if (skipSystemCover) {
      if (!isCoverRequiredType(merged.type)) {
        return NextResponse.json({ error: 'ตัวเลือกข้ามหน้าปกระบบใช้ได้เฉพาะ QP/WI' }, { status: 422 })
      }
      if (!canSkipSystemCover(actor)) {
        return NextResponse.json({ error: 'เฉพาะ Admin, Quality Manager หรือ Laboratory Director เท่านั้นที่ข้ามการสร้างหน้าปกระบบได้' }, { status: 403 })
      }
      if (!merged.file_url || !merged.file_name) {
        return NextResponse.json({ error: 'ต้องมี PDF ทางการที่มีหน้าปกครบก่อนข้ามการสร้างหน้าปกระบบ' }, { status: 422 })
      }
      if (!isPdfFile({ name: String(merged.file_name), type: String(merged.mime_type ?? '') })) {
        return NextResponse.json({ error: 'QP/WI ที่ข้ามหน้าปกระบบต้องใช้ไฟล์ PDF ทางการเท่านั้น' }, { status: 422 })
      }
    }
    const finalHeaderMetadata: DocxHeaderMetadata = buildDocxHeaderMetadata({
      ...merged,
      document_code: parentDoc.document_code,
    })
    const patchedKeys = new Set<string>()
    const patchDraftTarget = async (
      key: string | null | undefined,
      name: string | null | undefined,
      sizeField: 'file_size' | 'word_size',
      draftOwnsFile: boolean,
    ) => {
      if (!draftOwnsFile || !key || patchedKeys.has(key)) return
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
        console.warn('Skipping draft source metadata patch after upload', {
          key,
          name,
          error: toMsg(err),
        })
        return
      }
      if (patchedSize !== null) {
        updates[sizeField] = patchedSize
        merged[sizeField] = patchedSize
      }
    }

    await patchDraftTarget(
      merged.word_url as string | null | undefined,
      merged.word_name as string | null | undefined,
      'word_size',
      !uploadedFile && (Boolean(updates.word_url) || merged.word_url !== parentDoc.word_url),
    )
    await patchDraftTarget(
      merged.file_url as string | null | undefined,
      merged.file_name as string | null | undefined,
      'file_size',
      !uploadedFile && (Boolean(updates.file_url) || merged.file_url !== parentDoc.file_url),
    )

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะอัปเดต' }, { status: 422 })
    }
    if (statusAfter !== 'Published') {
      const { data, error } = await supabaseAdmin
        .from('document_revision_drafts')
        .update(updates)
        .eq('id', draftId)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (nextStatus && nextStatus !== draft.status) {
        supabaseAdmin.from('audit_log').insert({
          action: 'document.revision_draft_status',
          user_id: actor.id,
          target: parentDoc.document_code ?? id,
          detail: `Rev. ${data.revision} · ${draft.status} → ${data.status}`,
        }).then(undefined, () => {})
      }
      return NextResponse.json(data)
    }

    const { data: current, error: currentErr } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()
    if (currentErr || !current) return NextResponse.json({ error: currentErr?.message ?? 'Current document not found' }, { status: 404 })

    try {
      await archiveCurrentRevision(current as Document, actor.id)
    } catch (archiveErr) {
      return NextResponse.json({ error: archiveErr instanceof Error ? archiveErr.message : String(archiveErr) }, { status: 500 })
    }

    const promoteUpdates: Record<string, unknown> = {
      title: merged.title,
      type: merged.type,
      department: merged.department,
      description: merged.description,
      status: 'Published',
      visibility: merged.visibility,
      revision: merged.revision,
      owner_name: merged.owner_name,
      reviewer_name: merged.reviewer_name,
      approver_name: merged.approver_name,
      reviewer_id: merged.reviewer_id,
      approver_id: merged.approver_id,
      audience_text: merged.audience_text,
      file_url: merged.file_url,
      file_name: merged.file_name,
      file_size: merged.file_size,
      mime_type: merged.mime_type,
      source_pdf_url: merged.source_pdf_url,
      source_pdf_name: merged.source_pdf_name,
      source_pdf_size: merged.source_pdf_size,
      source_pdf_mime_type: merged.source_pdf_mime_type,
      word_url: merged.word_url,
      word_name: merged.word_name,
      word_size: merged.word_size,
      edit_date: merged.edit_date,
      effective_date: merged.effective_date,
      expiry_date: merged.expiry_date,
      approved_at: merged.approved_at,
      published_at: merged.published_at,
      approved_by_id: merged.approved_by_id,
      published_by_id: merged.published_by_id,
      cover_template_version: null,
      cover_generated_at: null,
      cover_metadata: userSkippedCover
        ? {
            skipped_system_cover: true,
            skipped_at: merged.published_at,
            skipped_by: actor.id,
            reason: 'revision_draft_pdf_has_existing_cover',
            file_url: merged.file_url,
            file_name: merged.file_name,
          }
        : null,
      imported_current_at: null,
      imported_current_by: null,
      imported_current_note: null,
      legacy_cover_included: userSkippedCover,
    }

    if (publishWithExistingCover && promoteUpdates.file_url && promoteUpdates.effective_date) {
      const effectiveDate = parseDateOnly(String(promoteUpdates.effective_date))
      if (effectiveDate) {
        const existingCoverPdf = await getObjectBuffer(String(promoteUpdates.file_url))
        const stampedPdf = await stampPublishedPdfFooter(
          existingCoverPdf,
          parentDoc.document_code,
          String(promoteUpdates.revision ?? ''),
          effectiveDate,
        )
        const {
          appendRevisionHistoryPdf,
          generateRevisionHistoryPdfForDocument,
        } = await import('@/lib/documents/revision-history-pdf')
        const historyPdf = await generateRevisionHistoryPdfForDocument(id, promoteUpdates)
        const finalPdf = await appendRevisionHistoryPdf(
          stampedPdf,
          historyPdf,
          { removeExistingPortalHistory: removePortalRevisionHistory },
        )
        const safeCode = parentDoc.document_code.replace(/[^a-zA-Z0-9._-]/g, '_')
        const stampedKey = `documents/generated/${id}/${Date.now()}-${safeCode}-existing-cover-final.pdf`
        await getR2Client().send(new PutObjectCommand({
          Bucket: getR2Bucket(),
          Key: stampedKey,
          Body: Buffer.from(finalPdf),
          ContentType: 'application/pdf',
        }))
        promoteUpdates.file_url = stampedKey
        promoteUpdates.file_size = finalPdf.length
        promoteUpdates.mime_type = 'application/pdf'
        if (promoteUpdates.cover_metadata && typeof promoteUpdates.cover_metadata === 'object') {
          promoteUpdates.cover_metadata = {
            ...(promoteUpdates.cover_metadata as Record<string, unknown>),
            revision_history_appended: true,
            file_url: stampedKey,
          }
        }
      }
    }

    if (COVER_GENERATION_ENABLED && isCoverRequiredType(merged.type) && !publishWithExistingCover) {
      const { buildPublishedPdfFields } = await import('@/lib/documents/publish')
      const finalFields = await buildPublishedPdfFields(id, promoteUpdates, {
        removeExistingPortalHistory: removePortalRevisionHistory,
      })
      if (finalFields) Object.assign(promoteUpdates, finalFields)
    }

    const { data: promoted, error: promoteErr } = await supabaseAdmin
      .from('documents')
      .update(promoteUpdates)
      .eq('id', id)
      .select()
      .single()
    if (promoteErr) return NextResponse.json({ error: promoteErr.message }, { status: 500 })

    await supabaseAdmin
      .from('document_revision_drafts')
      .update({ ...updates, status: 'Published' })
      .eq('id', draftId)

    // Hard-delete draft attachments (supporting files only). The Word/Excel source and the
    // official file were already promoted to the document above, so they are kept; these
    // attachment files are no longer needed once the revision is published. Wrapped so that a
    // failed cleanup can never break a publish that has already succeeded.
    try {
      const { data: draftAttachments } = await supabaseAdmin
        .from('document_revision_draft_attachments')
        .select('file_url')
        .eq('draft_id', draftId)
      for (const att of draftAttachments ?? []) {
        if (att.file_url) {
          await getR2Client().send(new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: att.file_url })).catch(() => {})
        }
      }
      await supabaseAdmin.from('document_revision_draft_attachments').delete().eq('draft_id', draftId)
    } catch {
      // non-fatal: publish already committed
    }

    supabaseAdmin.from('audit_log').insert({
      action: publishWithExistingCover ? 'document.revision_draft_publish_existing_cover' : 'document.revision_draft_publish',
      user_id: actor.id,
      target: promoted.document_code ?? id,
      detail: publishWithExistingCover
        ? `Rev. ${promoted.revision} · skipped system cover · used uploaded PDF as official file`
        : `Rev. ${promoted.revision}`,
    }).then(undefined, () => {})

    return NextResponse.json(promoted)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const actor = await getActor()
    if (!actor) return jsonUnauthorized()
    if (!(await canAccessDocuments(actor, 'edit'))) return jsonForbidden()
    const { id, draftId } = await params
    const reason = req.nextUrl.searchParams.get('reason')

    const incomingMemberships = await getActiveOwnedRevisionSetMemberships(draftId)
    if (incomingMemberships.length > 0) {
      return NextResponse.json({
        error: `ยกเลิก revision draft ไม่ได้ เพราะยังเป็นสมาชิกชุดเอกสาร ${incomingMemberships[0].mainDocumentCode}`,
        blocker: incomingMemberships[0],
      }, { status: 409 })
    }

    const { data, error } = await supabaseAdmin
      .from('document_revision_drafts')
      .update({ cancelled_at: new Date().toISOString(), cancelled_by: actor.id, cancel_reason: reason || null })
      .eq('id', draftId)
      .eq('document_id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
