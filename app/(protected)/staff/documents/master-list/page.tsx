import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRolePermissions } from '@/lib/permissions'
import { MasterListClient } from './MasterListClient'

export default async function MasterListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase
    .from('profiles').select('role, doc_role, name').eq('id', user!.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['Master List'] ?? 'none') === 'none') redirect('/staff/dashboard')

  return (
    <MasterListClient
      userRole={actor?.role ?? undefined}
      docRole={actor?.doc_role ?? undefined}
      userName={actor?.name ?? undefined}
    />
  )
}
