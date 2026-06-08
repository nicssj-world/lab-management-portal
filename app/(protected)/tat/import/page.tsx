import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'

export default async function TATImportPage() {
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
  if (perms['TAT'] === 'view') redirect('/tat')
  redirect('/tat/upload')
  return null
}
