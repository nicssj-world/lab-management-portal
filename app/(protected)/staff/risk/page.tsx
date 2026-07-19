import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { RiskClient, type RiskSection } from '@/components/risk/RiskClient'

export async function renderRiskSection(activeSection: RiskSection) {
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
  const permission = perms['ความเสี่ยง / Rejection'] ?? 'none'
  if (permission === 'none') redirect('/staff/dashboard')

  return <RiskClient permission={permission} canReview={profile.role === 'Admin' || profile.role === 'Manager'} activeSection={activeSection} />
}

export default async function RiskPage() {
  return renderRiskSection('dashboard')
}
