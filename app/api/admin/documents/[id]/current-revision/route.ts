import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { NextRequest, NextResponse } from 'next/server'
import type { Document } from '@/lib/supabase/types'

type Params = { params: Promise<{ id: string }> }

type RevisionArchive = {
  id: string
  document_id: string
  revision_number: string
  revision_note: string | null
  revised_by: string | null
  approved_by: string | null
  file_url: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  source_pdf_url: string | null
  source_pdf_name: string | null
  source_pdf_size: number | null
  source_pdf_mime_type: string | null
  word_url: string | null
  word_name: string | null
  word_size: number | null
  edit_date: string | null
  effective_date: string | null
  expiry_date: string | null
  approved_at: string | null
  published_at: string | null
  approved_by_id: string | null
  published_by_id: string | null
  reviewer_id: string | null
  approver_id: string | null
  audience_text: string | null
  cover_template_version: string | null
  cover_generated_at: string | null
  cover_metadata: Record<string, unknown> | null
  imported_current_at: string | null
  imported_current_by: string | null
  imported_current_note: string | null
  legacy_cover_included: boolean | null
  history_source: string | null
  created_at: string
}

const DOCUMENT_TYPES = new Set(['QP', 'WI', 'Form', 'Policy', 'Manual', 'Record', 'Reference', 'Card file', 'Others'])

function canRollbackCurrentRevision(actor: { role: string; doc_role?: string | null }) {
  return actor.role === 'Admin' || actor.role === 'Document Controller' || actor.doc_role === 'Document Controller'
}

function toMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function textFrom(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function nullableTextFrom(record: Record<string, unknown> | null, key: string) {
  if (!record || !(key in record)) return undefined
  const value = record[key]
  if (value === null) return null
  if (typeof value === 'string') return value.trim() || null
  return undefined
}

function promotedTypeFrom(metadata: Record<string, unknown> | null, fallback: Document['type']) {
  const value = textFrom(metadata, 'type')
  return DOCUMENT_TYPES.has(value ?? '') ? value as Document['type'] : fallback
}

function buildPromoteUpdates(previous: RevisionArchive, current: Document) {
  const metadata = asRecord(previous.cover_metadata)
  const ownerMeta = asRecord(metadata?.owner)
  const reviewerMeta = asRecord(metadata?.reviewer)
  const approverMeta = asRecord(metadata?.approver)
  const metadataDepartment = nullableTextFrom(metadata, 'department')

  return {
    title: textFrom(metadata, 'title') ?? current.title,
    type: promotedTypeFrom(metadata, current.type),
    department: metadataDepartment !== undefined ? metadataDepartment : current.department,
    description: previous.revision_note ?? current.description ?? null,
    status: 'Published',
    revision: previous.revision_number,
    owner_id: textFrom(ownerMeta, 'id') ?? current.owner_id ?? null,
    owner_name: textFrom(ownerMeta, 'name') ?? previous.revised_by ?? current.owner_name ?? null,
    reviewer_name: textFrom(reviewerMeta, 'name') ?? current.reviewer_name ?? null,
    approver_name: textFrom(approverMeta, 'name') ?? previous.approved_by ?? current.approver_name ?? null,
    reviewer_id: previous.reviewer_id ?? textFrom(reviewerMeta, 'id') ?? current.reviewer_id ?? null,
    approver_id: previous.approver_id ?? textFrom(approverMeta, 'id') ?? current.approver_id ?? null,
    audience_text: previous.audience_text ?? textFrom(metadata, 'audience_text') ?? current.audience_text ?? null,
    file_url: previous.file_url,
    file_name: previous.file_name,
    file_size: previous.file_size,
    mime_type: previous.mime_type,
    source_pdf_url: previous.source_pdf_url,
    source_pdf_name: previous.source_pdf_name,
    source_pdf_size: previous.source_pdf_size,
    source_pdf_mime_type: previous.source_pdf_mime_type,
    word_url: previous.word_url,
    word_name: previous.word_name,
    word_size: previous.word_size,
    edit_date: previous.edit_date,
    effective_date: previous.effective_date,
    expiry_date: previous.expiry_date ?? previous.edit_date ?? previous.effective_date ?? null,
    approved_at: previous.approved_at,
    published_at: previous.published_at,
    approved_by_id: previous.approved_by_id,
    published_by_id: previous.published_by_id,
    cover_template_version: previous.cover_template_version,
    cover_generated_at: previous.cover_generated_at,
    cover_metadata: previous.cover_metadata,
    imported_current_at: previous.imported_current_at,
    imported_current_by: previous.imported_current_by,
    imported_current_note: previous.imported_current_note,
    legacy_cover_included: previous.legacy_cover_included ?? false,
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: Params,
) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!canRollbackCurrentRevision(actor)) return jsonForbidden()

  const { id } = await params

  try {
    const { data: current, error: currentErr } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (currentErr || !current) {
      return NextResponse.json({ error: currentErr?.message ?? 'Document not found' }, { status: 404 })
    }

    const currentDoc = current as Document
    if (currentDoc.status !== 'Published') {
      return NextResponse.json({ error: 'ลบ current revision ได้เฉพาะเอกสารสถานะ Published เท่านั้น' }, { status: 409 })
    }

    const { data: activeDraft } = await supabaseAdmin
      .from('document_revision_drafts')
      .select('id, revision, status')
      .eq('document_id', id)
      .is('cancelled_at', null)
      .neq('status', 'Published')
      .maybeSingle()

    if (activeDraft) {
      return NextResponse.json({
        error: 'มี Working revision ค้างอยู่ กรุณายกเลิกหรือ Publish ก่อนลบ current revision',
      }, { status: 409 })
    }

    const { data: previous, error: previousErr } = await supabaseAdmin
      .from('document_revisions')
      .select('*')
      .eq('document_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (previousErr) return NextResponse.json({ error: previousErr.message }, { status: 500 })
    if (!previous) {
      return NextResponse.json({ error: 'ไม่มี Revision ก่อนหน้าให้เลื่อนขึ้นมาแทน' }, { status: 409 })
    }

    const previousRevision = previous as RevisionArchive
    if (!previousRevision.file_url || !previousRevision.file_name) {
      return NextResponse.json({
        error: `Rev. ${previousRevision.revision_number} ไม่มีไฟล์ทางการ จึงเลื่อนขึ้นมาเป็น current revision ไม่ได้`,
      }, { status: 422 })
    }

    const promoteUpdates = buildPromoteUpdates(previousRevision, currentDoc)
    const { data: promoted, error: promoteErr } = await supabaseAdmin
      .from('documents')
      .update(promoteUpdates)
      .eq('id', id)
      .select()
      .single()

    if (promoteErr) return NextResponse.json({ error: promoteErr.message }, { status: 500 })

    const { error: deleteErr } = await supabaseAdmin
      .from('document_revisions')
      .delete()
      .eq('id', previousRevision.id)
      .eq('document_id', id)

    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

    supabaseAdmin.from('document_access_logs')
      .insert({ document_id: id, user_id: actor.id, action: 'edit' })
      .then(undefined, () => {})

    supabaseAdmin.from('audit_log').insert({
      action: 'document.current_revision_rollback',
      user_id: actor.id,
      target: promoted?.document_code ?? id,
      detail: `Deleted Rev. ${currentDoc.revision}; promoted Rev. ${previousRevision.revision_number}`,
    }).then(undefined, () => {})

    return NextResponse.json({
      document: promoted,
      promotedRevisionId: previousRevision.id,
    })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
