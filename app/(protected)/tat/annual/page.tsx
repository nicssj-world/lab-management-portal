import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { TatAnnualClient } from './TatAnnualClient'

export default async function TatAnnualPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const perms = profile?.role ? await getRolePermissions(profile.role) : {}
  if ((perms['TAT'] ?? 'none') === 'none') redirect('/staff/dashboard')

  return <TatAnnualClient />
}
