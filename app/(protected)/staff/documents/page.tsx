import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRolePermissions } from '@/lib/permissions'
import { DocumentsClient } from './DocumentsClient'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['เอกสารคุณภาพ'] ?? 'none') === 'none') redirect('/staff/dashboard')

  return <DocumentsClient userRole={actor?.role ?? undefined} canEdit={perms['เอกสารคุณภาพ'] === 'edit'} />
}
