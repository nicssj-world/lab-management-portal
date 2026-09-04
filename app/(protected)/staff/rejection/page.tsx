import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { REJECTION_RESOURCE } from '@/lib/permission-resources'
import RejectionClient from '@/components/rejection/RejectionClient'

export default async function RejectionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('id,role').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const perms = await getRolePermissions(profile.role)
  if ((perms[REJECTION_RESOURCE] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms[REJECTION_RESOURCE] === 'edit'

  return <RejectionClient canEdit={canEdit} />
}
