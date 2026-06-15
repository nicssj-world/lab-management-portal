import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { getActor, canAccessDocuments, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { allowedTransitions, type DocStatus } from '@/lib/documents/transitions'
import { DocumentSchema } from '@/lib/validations/document'
import { buildPublishedPdfFields } from '@/lib/documents/publish'
import { canMoveToStatus, isCoverRequiredType, isPdfFile, isSourceFile } from '@/lib/documents/workflow'
import { isDocxFile, patchDocxHeaderMetadata, type DocxHeaderMetadata } from '@/lib/documents/docx-header'
import { isXlsxFile, patchXlsxHeaderMetadata } from '@/lib/documents/xlsx-header'
import { buildDocxHeaderMetadata } from '@/lib/documents/metadata'
import { stampPublishedPdfFooter } from '@/lib/documents/date-inject'

type Params = { params: Promise<{ id: string; draftId: string }> }
const STATUS_CHANGE_INPUT_FIELDS = new Set(['status', 'obsolete_reason'])

function toMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

function canSkipSystemCover(actor: { role: string; doc_role?: string | null }) {
  return actor.role === 'Admin'
    || actor.role === 'Quality Manager'
    || actor.role === 'Laboratory Director'
    || actor.doc_role === 'Quality Manager'
    || actor.doc_role === 'Laboratory Director'
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

function parseDateOnly(value: string | null | undefined) {
  const clean = value?.trim()
  if (!clean) return null
  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const parsed = new Date(clean)
  return Number.isNaN(parsed.getTime()) ? null : parsed
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
      .select('document_code, file_url, word_url')
      .eq('id', id)
      .single()
    if (!parentDoc) return NextResponse.json({ error: 'Current document not found' }, { status: 404 })

    const contentType = req.headers.get('content-type') ?? ''
    let updates: Record<string, unknown> = {}
    let officialFile: File | null = null
    let sourceFile: File | null = null
    let skipSystemCover = false

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
        const parsed = DocumentSchema.partial().safeParse(rawMeta)
        if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })
        updates = parsed.data as Record<string, unknown>
      }
    } else {
      const rawBody = await req.json() as Record<string, unknown>
      skipSystemCover = rawBody.skip_system_cover === true
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
    }

    const targetType = ((updates.type as string | undefined) ?? draft.type) as string
    const sourceUploadDate = sourceFile ? todayIsoDate() : undefined
    if (sourceUploadDate) {
      updates.edit_date = sourceUploadDate
      updates.expiry_date = sourceUploadDate
      if (!updates.owner_name && !draft.owner_name && actor.name) updates.owner_name = actor.name
    } else if (typeof updates.edit_date === 'string' && !updates.expiry_date) {
      updates.expiry_date = updates.edit_date
    } else if (typeof updates.expiry_date === 'string' && !updates.edit_date) {
      updates.edit_date = updates.expiry_date
    }

    if (officialFile) {
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
    }

    const statusAfter = (nextStatus ?? draft.status) as string
    const workflowCheck = canMoveToStatus({
      type: targetType,
      file_url: (updates.file_url as string | null | undefined) ?? draft.file_url ?? null,
      source_pdf_url: (updates.source_pdf_url as string | null | undefined) ?? draft.source_pdf_url ?? null,
      word_url: (updates.word_url as string | null | undefined) ?? draft.word_url ?? null,
    }, statusAfter)
    if (!workflowCheck.ok) return NextResponse.json({ error: workflowCheck.error }, { status: 422 })

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
    const publishWithExistingCover = Boolean(skipSystemCover && statusAfter === 'Published' && isCoverRequiredType(merged.type))
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
      const patchedSize = canPatchDocx
        ? await patchR2DocxObject(key, finalHeaderMetadata)
        : await patchR2XlsxObject(key, finalHeaderMetadata)
      if (patchedSize !== null) {
        updates[sizeField] = patchedSize
        merged[sizeField] = patchedSize
      }
    }

    await patchDraftTarget(
      merged.word_url as string | null | undefined,
      merged.word_name as string | null | undefined,
      'word_size',
      Boolean(updates.word_url) || merged.word_url !== parentDoc.word_url,
    )
    await patchDraftTarget(
      merged.file_url as string | null | undefined,
      merged.file_name as string | null | undefined,
      'file_size',
      Boolean(updates.file_url) || merged.file_url !== parentDoc.file_url,
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

    const { error: archiveErr } = await supabaseAdmin
      .from('document_revisions')
      .insert({
        document_id: id,
        revision_number: current.revision ?? '1',
        revision_note: current.description ?? null,
        revised_by: current.owner_name ?? null,
        approved_by: current.approver_name ?? null,
        file_url: current.file_url ?? '',
        file_name: current.file_name ?? '',
        file_size: current.file_size ?? null,
        mime_type: current.mime_type ?? null,
        source_pdf_url: current.source_pdf_url ?? null,
        source_pdf_name: current.source_pdf_name ?? null,
        source_pdf_size: current.source_pdf_size ?? null,
        source_pdf_mime_type: current.source_pdf_mime_type ?? null,
        word_url: current.word_url ?? null,
        word_name: current.word_name ?? null,
        word_size: current.word_size ?? null,
        edit_date: current.edit_date ?? null,
        effective_date: current.effective_date ?? null,
        approved_at: current.approved_at ?? null,
        published_at: current.published_at ?? null,
        approved_by_id: current.approved_by_id ?? null,
        published_by_id: current.published_by_id ?? null,
        reviewer_id: current.reviewer_id ?? null,
        approver_id: current.approver_id ?? null,
        audience_text: current.audience_text ?? null,
        cover_template_version: current.cover_template_version ?? null,
        cover_generated_at: current.cover_generated_at ?? null,
        cover_metadata: current.cover_metadata ?? null,
        imported_current_at: current.imported_current_at ?? null,
        imported_current_by: current.imported_current_by ?? null,
        imported_current_note: current.imported_current_note ?? null,
        legacy_cover_included: current.legacy_cover_included ?? false,
        uploaded_by: actor.id,
      })

    if (archiveErr) return NextResponse.json({ error: archiveErr.message }, { status: 500 })

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
      cover_metadata: publishWithExistingCover
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
      legacy_cover_included: publishWithExistingCover,
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
        const safeCode = parentDoc.document_code.replace(/[^a-zA-Z0-9._-]/g, '_')
        const stampedKey = `documents/generated/${id}/${Date.now()}-${safeCode}-existing-cover-final.pdf`
        await r2.send(new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: stampedKey,
          Body: stampedPdf,
          ContentType: 'application/pdf',
        }))
        promoteUpdates.file_url = stampedKey
        promoteUpdates.file_size = stampedPdf.length
        promoteUpdates.mime_type = 'application/pdf'
        if (promoteUpdates.cover_metadata && typeof promoteUpdates.cover_metadata === 'object') {
          promoteUpdates.cover_metadata = {
            ...(promoteUpdates.cover_metadata as Record<string, unknown>),
            file_url: stampedKey,
          }
        }
      }
    }

    if (isCoverRequiredType(merged.type) && !publishWithExistingCover) {
      const finalFields = await buildPublishedPdfFields(id, promoteUpdates)
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
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!(await canAccessDocuments(actor, 'edit'))) return jsonForbidden()
  const { id, draftId } = await params
  const reason = req.nextUrl.searchParams.get('reason')

  const { data, error } = await supabaseAdmin
    .from('document_revision_drafts')
    .update({ cancelled_at: new Date().toISOString(), cancelled_by: actor.id, cancel_reason: reason || null })
    .eq('id', draftId)
    .eq('document_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
