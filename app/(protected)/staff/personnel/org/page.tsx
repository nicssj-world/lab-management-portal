import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { formatProfileName } from '@/lib/personnel/name'
import { OrgChartClient, type StaffOption } from './OrgChartClient'

export default async function OrgChartPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['บุคลากร'] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms['บุคลากร'] === 'edit'

  const { data: staff } = await supabaseAdmin.from('profiles').select('id, name, name_prefix').eq('status', 'active').is('deleted_at', null).order('name')
  const staffOptions: StaffOption[] = (staff ?? []).map((s) => ({ id: s.id, name: formatProfileName(s.name, s.name_prefix) }))

  return <OrgChartClient canEdit={canEdit} staff={staffOptions} />
}
