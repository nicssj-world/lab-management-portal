import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { getActor, canAccessDocuments, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { allowedTransitions, type DocStatus } from '@/lib/documents/transitions'
import { DocumentSchema } from '@/lib/validations/document'
import { buildPublishedPdfFields } from '@/lib/documents/publish'
import { canMoveToStatus, isCoverRequiredType, isPdfFile, isSourceFile } from '@/lib/documents/workflow'

type Params = { params: Promise<{ id: string; draftId: string }> }

function toMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

async function uploadDocumentObject(file: File, type: string, prefix = '') {
  const year = new Date().getFullYear()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const r2Key = `documents/${type.toLowerCase()}/${year}/${Date.now()}-${prefix}${safeName}`
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    Body: Buffer.from(await file.arrayBuffer()),
    ContentType: file.type || 'application/octet-stream',
  }))
  return r2Key
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

    const contentType = req.headers.get('content-type') ?? ''
    let updates: Record<string, unknown> = {}
    let officialFile: File | null = null
    let sourceFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const officialRaw = form.get('file')
      officialFile = officialRaw instanceof File && officialRaw.size > 0 ? officialRaw : null
      const sourceRaw = form.get('word_file')
      sourceFile = sourceRaw instanceof File && sourceRaw.size > 0 ? sourceRaw : null
      const metaRaw = form.get('meta')
      if (metaRaw) {
        const parsed = DocumentSchema.partial().safeParse(JSON.parse(metaRaw as string))
        if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })
        updates = parsed.data as Record<string, unknown>
      }
    } else {
      const parsed = DocumentSchema.partial().safeParse(await req.json())
      if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 })
      updates = parsed.data as Record<string, unknown>
    }

    const nextStatus = updates.status as string | undefined
    if (nextStatus && nextStatus !== draft.status) {
      const allowed = allowedTransitions(draft.status as DocStatus, actor.role, actor.doc_role ?? undefined)
      if (!allowed.includes(nextStatus as DocStatus)) {
        return NextResponse.json({ error: 'สถานะที่เปลี่ยนไม่ได้รับอนุญาต' }, { status: 403 })
      }
    }

    const targetType = ((updates.type as string | undefined) ?? draft.type) as string
    if (officialFile) {
      if (officialFile.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'ไฟล์ทางการใหญ่เกิน 50 MB' }, { status: 422 })
      if (isCoverRequiredType(targetType) && !isPdfFile(officialFile)) {
        return NextResponse.json({ error: 'QP/WI ต้องใช้ PDF เนื้อหาในช่องไฟล์ทางการ' }, { status: 422 })
      }
      if (!isCoverRequiredType(targetType) && !isPdfFile(officialFile) && !isSourceFile(officialFile)) {
        return NextResponse.json({ error: 'ไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
      }
      const key = await uploadDocumentObject(officialFile, targetType, 'draft-official-')
      updates.file_url = key
      updates.file_name = officialFile.name
      updates.file_size = officialFile.size
      updates.mime_type = officialFile.type || 'application/octet-stream'
      if (isCoverRequiredType(targetType)) {
        updates.source_pdf_url = key
        updates.source_pdf_name = officialFile.name
        updates.source_pdf_size = officialFile.size
        updates.source_pdf_mime_type = officialFile.type || 'application/pdf'
      }
    }

    if (sourceFile) {
      if (sourceFile.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'ไฟล์ต้นฉบับใหญ่เกิน 50 MB' }, { status: 422 })
      if (!isSourceFile(sourceFile)) return NextResponse.json({ error: 'ไฟล์ต้นฉบับรองรับ DOC, DOCX, XLS, XLSX เท่านั้น' }, { status: 422 })
      const key = await uploadDocumentObject(sourceFile, targetType, 'draft-source-')
      updates.word_url = key
      updates.word_name = sourceFile.name
      updates.word_size = sourceFile.size
      if (!updates.edit_date) updates.edit_date = new Date().toISOString().split('T')[0]
    }

    const statusAfter = (nextStatus ?? draft.status) as string
    const workflowCheck = canMoveToStatus({
      type: targetType,
      file_url: (updates.file_url as string | null | undefined) ?? draft.file_url ?? null,
      source_pdf_url: (updates.source_pdf_url as string | null | undefined) ?? draft.source_pdf_url ?? null,
    }, statusAfter)
    if (!workflowCheck.ok) return NextResponse.json({ error: workflowCheck.error }, { status: 422 })

    if (nextStatus && nextStatus !== draft.status) {
      if (nextStatus === 'Approved') {
        updates.approved_at = new Date().toISOString()
        updates.approved_by_id = actor.id
      }
      if (nextStatus === 'Published') {
        const now = new Date().toISOString()
        updates.published_at = now
        updates.published_by_id = actor.id
        if (!updates.effective_date && !draft.effective_date) updates.effective_date = now.split('T')[0]
      }
    }

    const merged = { ...draft, ...updates }
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
        source_pdf_url: current.source_pdf_url ?? null,
        source_pdf_name: current.source_pdf_name ?? null,
        word_url: current.word_url ?? null,
        word_name: current.word_name ?? null,
        edit_date: current.edit_date ?? null,
        effective_date: current.effective_date ?? null,
        approved_at: current.approved_at ?? null,
        published_at: current.published_at ?? null,
        approved_by_id: current.approved_by_id ?? null,
        published_by_id: current.published_by_id ?? null,
        cover_template_version: current.cover_template_version ?? null,
        cover_metadata: current.cover_metadata ?? null,
        uploaded_by: actor.id,
      })

    if (archiveErr) return NextResponse.json({ error: archiveErr.message }, { status: 500 })

    const promoteUpdates = {
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
      cover_metadata: null,
    }

    if (isCoverRequiredType(merged.type)) {
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
      action: 'document.revision_draft_publish',
      user_id: actor.id,
      target: promoted.document_code ?? id,
      detail: `Rev. ${promoted.revision}`,
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
