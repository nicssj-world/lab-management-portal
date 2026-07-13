import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { CategoriesClient, type CategoryDoc } from './CategoriesClient'

export const dynamic = 'force-dynamic'

const DOCUMENT_WORKFLOW_ACCESS_ROLES = ['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer', 'Viewer']

export default async function DocumentCategoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: actor } = await supabase
    .from('profiles').select('role, doc_role, name').eq('id', user.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  const hasWorkflowAccess = DOCUMENT_WORKFLOW_ACCESS_ROLES.includes(actor?.doc_role ?? '')
  if (!hasWorkflowAccess && (perms['เอกสารคุณภาพ'] ?? 'none') === 'none') redirect('/staff/dashboard')

  let query = supabaseAdmin
    .from('documents')
    .select('id, document_code, title, type, status, department, revision, effective_date, expiry_date, file_url')
    .is('deleted_at', null)
    .order('document_code', { ascending: true })

  // Viewer doc_role sees Published documents only (mirrors the documents list API)
  if (actor?.doc_role === 'Viewer') query = query.eq('status', 'Published')

  const { data } = await query

  return (
    <CategoriesClient
      docs={(data ?? []) as CategoryDoc[]}
      userRole={actor?.role ?? undefined}
      docRole={actor?.doc_role ?? undefined}
      userName={actor?.name ?? undefined}
      userId={user.id}
    />
  )
}
