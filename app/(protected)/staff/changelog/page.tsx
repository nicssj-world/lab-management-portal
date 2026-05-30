import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { ChangelogClient } from './ChangelogClient'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role, name').eq('id', user.id).single()
  return data as { id: string; role: string; name: string } | null
}

export default async function ChangelogPage() {
  const actor = await getActor()
  if (!actor) redirect('/login')

  const perms = await getRolePermissions(actor.role)
  if ((perms['บันทึกการแก้ไข'] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms['บันทึกการแก้ไข'] === 'edit'

  const { data: items } = await supabaseAdmin
    .from('system_changelog')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <ChangelogClient
      initialData={items ?? []}
      canEdit={canEdit}
      currentUserName={actor.name ?? ''}
    />
  )
}
