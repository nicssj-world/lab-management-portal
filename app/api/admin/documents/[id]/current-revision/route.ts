import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

const DOC_UPLOAD_ROLES = ['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer']

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role, doc_role').eq('id', user.id).single()
  return data as { id: string; role: string; doc_role: string | null } | null
}

async function canEditDocuments(role: string, docRole: string | null) {
  if (role === 'Admin') return true
  if (DOC_UPLOAD_ROLES.includes(docRole ?? role)) return true
  const perms = await getRolePermissions(role)
  return (perms['เอกสารคุณภาพ'] ?? 'none') === 'edit'
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canEditDocuments(actor.role, actor.doc_role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const { data: previous, error: prevErr } = await supabaseAdmin
    .from('document_revisions')
    .select('*')
    .eq('document_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (prevErr) return NextResponse.json({ error: prevErr.message }, { status: 500 })
  if (!previous) {
    return NextResponse.json({ error: 'ไม่มี Revision ก่อนหน้าให้เลื่อนขึ้นมาแทน' }, { status: 422 })
  }

  const updates: Record<string, unknown> = {
    revision: previous.revision_number,
    description: previous.revision_note,
    owner_name: previous.revised_by,
    approver_name: previous.approved_by,
  }

  if (previous.file_url) updates.file_url = previous.file_url
  if (previous.file_name) updates.file_name = previous.file_name

  const { data: document, error: updateErr } = await supabaseAdmin
    .from('documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  const { error: deleteErr } = await supabaseAdmin
    .from('document_revisions')
    .delete()
    .eq('id', previous.id)

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  supabaseAdmin.from('document_access_logs')
    .insert({
      document_id: id,
      user_id: actor.id,
      action: 'edit',
    })
    .then(undefined, () => {})

  return NextResponse.json({ document, promotedRevisionId: previous.id })
}
