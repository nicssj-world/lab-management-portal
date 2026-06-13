import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getActor, jsonUnauthorized } from '@/lib/auth/guards'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

const WORKFLOW_LOCK_ERROR =
  'Only backfilled revision history can be edited directly. Workflow revisions must stay immutable.'

type Params = { params: Promise<{ id: string; revId: string }> }

function canBackfillRevisionHistory(actor: { role: string; doc_role: string | null }) {
  return actor.role === 'Admin' || actor.role === 'Document Controller' || actor.doc_role === 'Document Controller'
}

function parseDateOnly(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return undefined
  return new Date(`${text}T00:00:00.000Z`).toISOString()
}

async function getBackfilledRevision(id: string, revId: string) {
  const { data, error } = await supabaseAdmin
    .from('document_revisions')
    .select('id, document_id, file_url, history_source')
    .eq('id', revId)
    .eq('document_id', id)
    .maybeSingle()
  if (error) throw error
  return data as { id: string; document_id: string; file_url: string | null; history_source: string | null } | null
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!canBackfillRevisionHistory(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, revId } = await params
  const revision = await getBackfilledRevision(id, revId)
  if (!revision) return NextResponse.json({ error: 'Revision not found' }, { status: 404 })
  if (revision.history_source !== 'backfill') {
    return NextResponse.json({ error: WORKFLOW_LOCK_ERROR }, { status: 409 })
  }

  const body = await req.json()
  const revisionNumber = typeof body.revision_number === 'string' ? body.revision_number.trim() : ''
  if (!revisionNumber) {
    return NextResponse.json({ error: 'กรุณากรอกหมายเลข Revision' }, { status: 422 })
  }

  const updates: Record<string, unknown> = {
    revision_number: revisionNumber,
    revision_note: typeof body.revision_note === 'string' && body.revision_note.trim() ? body.revision_note.trim() : null,
    revised_by: typeof body.revised_by === 'string' && body.revised_by.trim() ? body.revised_by.trim() : null,
    approved_by: typeof body.approved_by === 'string' && body.approved_by.trim() ? body.approved_by.trim() : null,
  }
  const createdAt = parseDateOnly(body.revision_date)
  if (createdAt) updates.created_at = createdAt

  const { data, error } = await supabaseAdmin
    .from('document_revisions')
    .update(updates)
    .eq('id', revId)
    .eq('document_id', id)
    .eq('history_source', 'backfill')
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'document.revision_history_backfill_update',
    user_id: actor.id,
    target: `${id}:${revId}`,
    detail: `Updated backfilled Rev. ${revisionNumber}`,
  }).then(undefined, () => {})

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!canBackfillRevisionHistory(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, revId } = await params
  const revision = await getBackfilledRevision(id, revId)
  if (!revision) return NextResponse.json({ error: 'Revision not found' }, { status: 404 })
  if (revision.history_source !== 'backfill') {
    return NextResponse.json({ error: WORKFLOW_LOCK_ERROR }, { status: 409 })
  }

  const { error } = await supabaseAdmin
    .from('document_revisions')
    .delete()
    .eq('id', revId)
    .eq('document_id', id)
    .eq('history_source', 'backfill')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (revision.file_url) {
    r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: revision.file_url })).catch(() => {})
  }

  supabaseAdmin.from('audit_log').insert({
    action: 'document.revision_history_backfill_delete',
    user_id: actor.id,
    target: `${id}:${revId}`,
    detail: 'Deleted backfilled revision history',
  }).then(undefined, () => {})

  return new NextResponse(null, { status: 204 })
}
