import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { getContracts } from '@/lib/queries/contracts'
import { ContractsClient } from './ContractsClient'

export default async function ContractsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['สัญญา'] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms['สัญญา'] === 'edit'

  const [contracts, profilesRes, usersRes] = await Promise.all([
    getContracts(supabase),
    supabaseAdmin.from('profiles').select('dept').not('dept', 'is', null),
    supabaseAdmin.from('profiles').select('id, name, role').eq('status', 'active').is('deleted_at', null).order('name'),
  ])

  const departments = [...new Set(
    (profilesRes.data ?? []).map((p: { dept: string | null }) => p.dept).filter(Boolean) as string[]
  )].filter(d => d !== 'Medical Technology').sort()

  const lastUpdated = contracts[0]?.created_at ?? null

  return (
    <ContractsClient
      contracts={contracts}
      canEdit={canEdit}
      lastUpdated={lastUpdated}
      departments={departments}
      currentUserId={user!.id}
      users={usersRes.data ?? []}
    />
  )
}
