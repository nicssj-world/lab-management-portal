import { NextRequest, NextResponse } from 'next/server'
import { canAccessDocuments, getActor, jsonForbidden, jsonUnauthorized, type Actor } from '@/lib/auth/guards'
import { isPdfFile, isSourceFile, nextRevisionValue } from '@/lib/documents/workflow'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { RegisterSetSchema, type RegisterSetItem } from '@/lib/validations/document-set'

type Params = { params: Promise<{ id: string }> }

type ItemSuccess = {
  index: number
  kind: RegisterSetItem['kind']
  item: RegisterSetItem
  data: unknown
}

type ItemFailure = {
  index: number
  kind: RegisterSetItem['kind']
  item: RegisterSetItem
  error: string
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return String(error)
}

function throwIfError(error: unknown) {
  if (error) throw error
}

function fileKind(file: { name: string; mime: string }) {
  const fileRef = { name: file.name, type: file.mime }
  if (isPdfFile(fileRef)) return 'pdf' as const
  if (isSourceFile(fileRef)) return 'source' as const
  throw new Error(`ไม่รองรับชนิดไฟล์ ${file.name}`)
}

async function setLink(documentId: string, linkedDocumentId: string, actor: Actor) {
  if (documentId === linkedDocumentId) throw new Error('ไม่สามารถลิงก์เอกสารตัวเองได้')

  const inserted = await supabaseAdmin
    .from('document_links')
    .insert({
      document_id: documentId,
      linked_doc_id: linkedDocumentId,
      link_kind: 'set',
      created_by: actor.id,
    })
    .select()
    .single()

  if (!inserted.error) return inserted.data
  if (inserted.error.code !== '23505') throw inserted.error

  const updated = await supabaseAdmin
    .from('document_links')
    .update({ link_kind: 'set' })
    .eq('document_id', documentId)
    .eq('linked_doc_id', linkedDocumentId)
    .select()
    .single()
  throwIfError(updated.error)
  return updated.data
}

async function registerDocument(mainDocumentId: string, item: Extract<RegisterSetItem, { kind: 'register' }>, actor: Actor) {
  const documentCode = item.document_code.trim().toUpperCase()
  const duplicate = await supabaseAdmin
    .from('documents')
    .select('id, revision, deleted_at')
    .eq('document_code', documentCode)
    .maybeSingle()
  throwIfError(duplicate.error)
  if (duplicate.data) {
    const state = duplicate.data.deleted_at ? ' (ถูกลบแบบ soft-delete)' : ''
    throw new Error(`รหัสเอกสาร ${documentCode} มีอยู่ในระบบแล้ว${state} (document_id: ${duplicate.data.id})`)
  }

  const kind = fileKind(item.file)
  const fileFields = kind === 'source'
    ? {
        word_url: item.file.key,
        word_name: item.file.name,
        word_size: item.file.size,
      }
    : {
        pending_file_url: item.file.key,
        pending_file_name: item.file.name,
        pending_file_size: item.file.size,
        pending_file_mime: item.file.mime,
      }

  const inserted = await supabaseAdmin
    .from('documents')
    .insert({
      document_code: documentCode,
      title: item.title,
      type: item.type,
      department: item.department,
      revision: item.revision,
      status: 'Draft',
      owner_id: actor.id,
      owner_name: item.owner_name,
      reviewer_name: item.reviewer_name,
      approver_name: item.approver_name,
      edit_date: item.edit_date,
      effective_date: item.effective_date,
      visibility: item.visibility,
      ...fileFields,
    })
    .select()
    .single()
  throwIfError(inserted.error)
  const document = inserted.data

  try {
    await setLink(mainDocumentId, document.id, actor)
  } catch (error) {
    // Keep this item retryable if its follow-up link fails. R2 objects are intentionally untouched.
    const cleanup = await supabaseAdmin.from('documents').delete().eq('id', document.id)
    if (cleanup.error) {
      throw new Error(
        `${errorMessage(error)}; ล้างเอกสารที่สร้างค้างไม่สำเร็จ (document_id: ${document.id}): ${cleanup.error.message}`,
      )
    }
    throw error
  }

  supabaseAdmin.from('document_access_logs')
    .insert({ document_id: document.id, user_id: actor.id, action: 'upload' })
    .then(undefined, () => {})
  supabaseAdmin.from('audit_log').insert({
    action: 'document.upload',
    user_id: actor.id,
    target: document.document_code,
    detail: `${document.document_code} · ${document.title}`,
  }).then(undefined, () => {})
  supabaseAdmin.from('document_status_history').insert({
    document_id: document.id,
    from_status: null,
    to_status: 'Draft',
    changed_by: actor.id,
    changed_at: document.created_at,
  }).then(undefined, () => {})

  return { document }
}

async function attachFile(mainDocumentId: string, item: Extract<RegisterSetItem, { kind: 'attach' }>, actor: Actor) {
  const inserted = await supabaseAdmin
    .from('document_attachments')
    .insert({
      document_id: mainDocumentId,
      file_url: item.file.key,
      file_name: item.file.name,
      file_size: item.file.size,
      mime_type: item.file.mime,
      uploaded_by: actor.id,
      ephemeral: true,
    })
    .select()
    .single()
  throwIfError(inserted.error)
  return { attachment: inserted.data }
}

async function reviseExisting(mainDocumentId: string, item: Extract<RegisterSetItem, { kind: 'revise-existing' }>, actor: Actor) {
  const currentResult = await supabaseAdmin
    .from('documents')
    .select('id, document_code, title, type, department, description, status, visibility, revision, owner_name, reviewer_name, approver_name, reviewer_id, approver_id, audience_text')
    .eq('id', item.existing_document_id)
    .is('deleted_at', null)
    .maybeSingle()
  throwIfError(currentResult.error)
  const current = currentResult.data
  if (!current) throw new Error('ไม่พบเอกสารที่ต้องการสร้าง revision')
  if (current.status !== 'Published') throw new Error('สร้าง working revision ได้เฉพาะเอกสาร Published เท่านั้น')

  const existingResult = await supabaseAdmin
    .from('document_revision_drafts')
    .select('*')
    .eq('document_id', current.id)
    .is('cancelled_at', null)
    .neq('status', 'Published')
    .maybeSingle()
  throwIfError(existingResult.error)

  let draft = existingResult.data
  let created = false
  if (!draft) {
    const inserted = await supabaseAdmin
      .from('document_revision_drafts')
      .insert({
        document_id: current.id,
        revision: nextRevisionValue(current.revision),
        title: current.title,
        type: current.type,
        department: current.department,
        description: null,
        status: 'Draft',
        visibility: current.visibility,
        owner_name: current.owner_name,
        reviewer_name: current.reviewer_name,
        approver_name: current.approver_name,
        reviewer_id: current.reviewer_id,
        approver_id: current.approver_id,
        audience_text: current.audience_text,
        created_by: actor.id,
      })
      .select()
      .single()
    throwIfError(inserted.error)
    draft = inserted.data
    created = true
  }

  // Establish the idempotent link before applying the uploaded file, so a retry cannot duplicate an attachment.
  await setLink(mainDocumentId, current.id, actor)

  const kind = fileKind(item.file)
  let fileResult: unknown
  if (kind === 'source') {
    const updated = await supabaseAdmin
      .from('document_revision_drafts')
      .update({
        word_url: item.file.key,
        word_name: item.file.name,
        word_size: item.file.size,
      })
      .eq('id', draft.id)
      .select()
      .single()
    throwIfError(updated.error)
    draft = updated.data
    fileResult = updated.data
  } else {
    const inserted = await supabaseAdmin
      .from('document_revision_draft_attachments')
      .insert({
        draft_id: draft.id,
        document_id: current.id,
        file_url: item.file.key,
        file_name: item.file.name,
        file_size: item.file.size,
        mime_type: item.file.mime,
        uploaded_by: actor.id,
      })
      .select()
      .single()
    throwIfError(inserted.error)
    fileResult = inserted.data
  }

  if (created) {
    supabaseAdmin.from('audit_log').insert({
      action: 'document.revision_draft_create',
      user_id: actor.id,
      target: current.document_code ?? current.id,
      detail: `Rev. ${draft.revision}`,
    }).then(undefined, () => {})
  }

  return { document: current, draft, file: fileResult, reused: !created }
}

async function processItem(mainDocumentId: string, item: RegisterSetItem, actor: Actor) {
  switch (item.kind) {
    case 'register':
      return registerDocument(mainDocumentId, item, actor)
    case 'attach':
      return attachFile(mainDocumentId, item, actor)
    case 'link-existing':
      return { link: await setLink(mainDocumentId, item.existing_document_id, actor) }
    case 'revise-existing':
      return reviseExisting(mainDocumentId, item, actor)
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!(await canAccessDocuments(actor, 'edit'))) return jsonForbidden()
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON ไม่ถูกต้อง' }, { status: 422 })
  }

  const parsed = RegisterSetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const mainResult = await supabaseAdmin
    .from('documents')
    .select('id, status')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (mainResult.error) return NextResponse.json({ error: mainResult.error.message }, { status: 500 })
  if (!mainResult.data) return NextResponse.json({ error: 'ไม่พบเอกสารหลัก' }, { status: 404 })
  if (mainResult.data.status !== 'Draft') {
    return NextResponse.json({ error: 'ลงทะเบียนชุดเอกสารได้เฉพาะเอกสารหลักสถานะ Draft' }, { status: 409 })
  }

  const succeeded: ItemSuccess[] = []
  const failed: ItemFailure[] = []
  for (const [index, item] of parsed.data.items.entries()) {
    try {
      const data = await processItem(id, item, actor)
      succeeded.push({ index, kind: item.kind, item, data })
    } catch (error) {
      failed.push({ index, kind: item.kind, item, error: errorMessage(error) })
    }
  }

  return NextResponse.json({ succeeded, failed })
}
