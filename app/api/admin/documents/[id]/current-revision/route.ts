import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

const DOC_UPLOAD_ROLES = ['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer']
const WORKFLOW_LOCK_ERROR =
  'Current published revision cannot be rolled back directly. Create and publish a working revision instead.'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, role, doc_role')
    .eq('id', user.id)
    .single()
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
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canEditDocuments(actor.role, actor.doc_role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  supabaseAdmin.from('audit_log').insert({
    action: 'document.current_revision_rollback_blocked',
    user_id: actor.id,
    target: id,
    detail: WORKFLOW_LOCK_ERROR,
  }).then(undefined, () => {})

  return NextResponse.json({ error: WORKFLOW_LOCK_ERROR }, { status: 409 })
}
