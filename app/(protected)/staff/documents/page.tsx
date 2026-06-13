import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRolePermissions } from '@/lib/permissions'
import { DocumentsClient } from './DocumentsClient'

const DOCUMENT_WORKFLOW_ACCESS_ROLES = ['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer', 'Viewer']

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase
    .from('profiles').select('role, doc_role, name').eq('id', user!.id).single()
  const userId = user!.id
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  const hasWorkflowAccess = DOCUMENT_WORKFLOW_ACCESS_ROLES.includes(actor?.doc_role ?? '')
  if (!hasWorkflowAccess && (perms['เอกสารคุณภาพ'] ?? 'none') === 'none') redirect('/staff/dashboard')

  return <DocumentsClient
    userRole={actor?.role ?? undefined}
    docRole={actor?.doc_role ?? undefined}
    userName={actor?.name ?? undefined}
    userId={userId}
  />
}
