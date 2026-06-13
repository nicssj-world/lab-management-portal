import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActor, canAccessDocuments, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { nextRevisionValue } from '@/lib/documents/workflow'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!(await canAccessDocuments(actor, 'view'))) return jsonForbidden()
  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('document_revision_drafts')
    .select('*')
    .eq('document_id', id)
    .is('cancelled_at', null)
    .neq('status', 'Published')
    .order('created_at', { ascending: false })
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!(await canAccessDocuments(actor, 'edit'))) return jsonForbidden()
  const { id } = await params

  const { data: current, error: currentErr } = await supabaseAdmin
    .from('documents')
    .select('id, title, type, department, description, status, visibility, revision, owner_name, reviewer_name, approver_name, reviewer_id, approver_id, audience_text')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (currentErr || !current) return NextResponse.json({ error: currentErr?.message ?? 'Not found' }, { status: 404 })
  if (current.status !== 'Published') {
    return NextResponse.json({ error: 'สร้าง working revision ได้เฉพาะเอกสาร Published เท่านั้น' }, { status: 409 })
  }

  const { data: existing } = await supabaseAdmin
    .from('document_revision_drafts')
    .select('*')
    .eq('document_id', id)
    .is('cancelled_at', null)
    .neq('status', 'Published')
    .maybeSingle()

  if (existing) return NextResponse.json(existing, { status: 200 })

  const { data, error } = await supabaseAdmin
    .from('document_revision_drafts')
    .insert({
      document_id: id,
      revision: nextRevisionValue(current.revision),
      title: current.title,
      type: current.type,
      department: current.department,
      description: current.description,
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'document.revision_draft_create',
    user_id: actor.id,
    target: id,
    detail: `Rev. ${data.revision}`,
  }).then(undefined, () => {})

  return NextResponse.json(data, { status: 201 })
}
