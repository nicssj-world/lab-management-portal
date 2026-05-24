import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import RejectionClient from '@/components/rejection/RejectionClient'

export default async function RejectionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('id,role').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const perms = await getRolePermissions(profile.role)
  if ((perms['ความเสี่ยง / Rejection'] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms['ความเสี่ยง / Rejection'] === 'edit'

  return <RejectionClient canEdit={canEdit} />
}
