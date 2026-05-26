import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { RiskClient } from '@/components/risk/RiskClient'

export default async function RiskPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const perms = await getRolePermissions(profile.role)
  if ((perms['ความเสี่ยง / Rejection'] ?? 'none') === 'none') redirect('/staff/dashboard')

  return <RiskClient />
}
