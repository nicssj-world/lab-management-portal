import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { NewsManageClient } from './NewsManageClient'

export default async function NewsManagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: actor } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()

  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['ข่าวสาร'] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms['ข่าวสาร'] === 'edit'

  return <NewsManageClient canEdit={canEdit} />
}
