import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { DocumentSchema } from '@/lib/validations/document'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessDocuments } from '@/lib/auth/guards'
import { allowedTransitions, type DocStatus } from '@/lib/documents/transitions'
import {
  canCorrectPublishedMetadata,
  canMoveToStatus,
  isCoverRequiredType,
  isPdfFile,
  isPublishedCoverMetadataField,
  isPublishedMetadataField,
  isSourceFile,
} from '@/lib/documents/workflow'
import { buildPublishedPdfFields } from '@/lib/documents/publish'
import { isDocxFile, patchDocxHeaderMetadata, type DocxHeaderMetadata } from '@/lib/documents/docx-header'
import { isXlsxFile, patchXlsxHeaderMetadata } from '@/lib/documents/xlsx-header'
import { buildDocxHeaderMetadata } from '@/lib/documents/metadata'

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
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await canUploadDocument(actor.role, actor.doc_role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const contentType = req.headers.get('content-type') ?? ''
    let updates: Record<string, unknown> = {}
    let newFile: File | null = null

    let newWordFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const fileRaw = form.get('file')
      newFile = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null
      const wordRaw = form.get('word_file')
      newWordFile = wordRaw instanceof File && wordRaw.size > 0 ? wordRaw : null

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
    const { data: current } = await supabaseAdmin
      .from('documents')
      .select('file_url, file_name, file_size, mime_type, source_pdf_url, source_pdf_name, source_pdf_size, source_pdf_mime_type, word_url, word_name, word_size, revision, type, description, owner_name, approver_name, status, document_code, title, edit_date, effective_date, expiry_date, approved_at, published_at, approved_by_id, published_by_id, reviewer_id, approver_id, audience_text, cover_template_version, cover_generated_at, cover_metadata, imported_current_at, imported_current_by, imported_current_note, legacy_cover_included')
      .eq('id', id)
      .single()

    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Enforce status transition rules server-side
    const requestedStatus = updates.status as string | undefined
    if (requestedStatus && current?.status && requestedStatus !== current.status) {
      if (newFile || (newWordFile && newWordFile.size > 0)) {
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
    }

    if (current.status === 'Published') {
      if (newFile || (newWordFile && newWordFile.size > 0)) {
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

    const sourceUploadDate = newWordFile && newWordFile.size > 0 ? todayIsoDate() : undefined
    if (sourceUploadDate) {
      updates.edit_date = sourceUploadDate
      updates.expiry_date = sourceUploadDate
      if (!updates.owner_name && !current.owner_name && actor.name) updates.owner_name = actor.name
    } else if (typeof updates.edit_date === 'string' && !updates.expiry_date) {
      updates.expiry_date = updates.edit_date
    } else if (typeof updates.expiry_date === 'string' && !updates.edit_date) {
      updates.edit_date = updates.expiry_date
    }

    if (newFile) {
      if (newFile.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 50 MB' }, { status: 422 })
      }

      const type = (updates.type as string) ?? current?.type ?? 'others'
      if (isCoverRequiredType(type) && !isPdfFile(newFile)) {
        return NextResponse.json({ error: 'QP/WI ต้องใช้ PDF เนื้อหาในช่องไฟล์ทางการ' }, { status: 422 })
      }
      if (!isCoverRequiredType(type) && !isPdfFile(newFile) && !isSourceFile(newFile)) {
        return NextResponse.json({ error: 'ไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
      }

      const headerMetadata: DocxHeaderMetadata = buildDocxHeaderMetadata({
        ...current,
        ...updates,
      })
      const uploaded = await uploadDocumentObject(newFile, type, '', headerMetadata)
      const r2Key = uploaded.key

      updates.file_url  = r2Key
      updates.file_name = newFile.name
      updates.file_size = uploaded.size
      updates.mime_type = newFile.type || 'application/octet-stream'
      if (isCoverRequiredType(type)) {
        updates.source_pdf_url = r2Key
        updates.source_pdf_name = newFile.name
        updates.source_pdf_size = uploaded.size
        updates.source_pdf_mime_type = newFile.type || 'application/pdf'
      }
    }

    if (newWordFile && newWordFile.size > 0) {
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
    }

    // Save old revision to history when revision number changes OR file is replaced
    const skipRevision = req.nextUrl.searchParams.get('skipRevision') === '1'
    const revisionChanged = updates.revision !== undefined && updates.revision !== current?.revision
    if (!skipRevision && (revisionChanged || newFile) && current?.file_url) {
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
        const patchedSize = canPatchDocx
          ? await patchR2DocxObject(key, finalHeaderMetadata)
          : await patchR2XlsxObject(key, finalHeaderMetadata)
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
    const shouldBuildFinalPdf = isCoverRequiredType(targetType)
      && !current.legacy_cover_included
      && (newStatus === 'Published' || publishedCoverMetadataChanged)
    if (shouldBuildFinalPdf) {
      const finalFields = await buildPublishedPdfFields(id, {
        ...updates,
        type: targetType,
        file_url: (updates.file_url as string | null | undefined) ?? current.file_url,
        source_pdf_url: (updates.source_pdf_url as string | null | undefined) ?? current.source_pdf_url,
      })
      if (finalFields) Object.assign(updates, finalFields)
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

    if (shouldBuildFinalPdf) {
      supabaseAdmin.from('audit_log').insert({
        action: current.status === 'Published' ? 'document.cover_regenerate' : 'document.cover_generate',
        user_id: actor.id,
        target: doc.document_code,
        detail: current.status === 'Published'
          ? `${doc.document_code} · cover metadata: ${publishedMetadataFields.filter(isPublishedCoverMetadataField).join(', ')}`
          : `${doc.document_code} · ${doc.title}`,
      }).then(undefined, () => {})
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
    const { data: deletedDoc, error: dbErr } = await supabaseAdmin
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('document_code, title')
      .single()

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    supabaseAdmin.from('document_access_logs')
      .insert({ document_id: id, user_id: actor.id, action: 'delete' })
      .then(undefined, () => {})

    supabaseAdmin.from('audit_log').insert({
      action: 'document.delete',
      user_id: actor.id,
      target: deletedDoc?.document_code ?? id,
      detail: deletedDoc ? `${deletedDoc.document_code} · ${deletedDoc.title}` : id,
    }).then(undefined, () => {})

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
