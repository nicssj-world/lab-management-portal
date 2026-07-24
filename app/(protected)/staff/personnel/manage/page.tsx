import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStaffRoster } from '@/lib/queries/personnel'
import { canManagePersonnel } from '@/lib/personnel/roles'
import { normalizeRole } from '@/lib/roles'
import { ManageClient, type ManageRow } from './ManageClient'

export default async function PersonnelManagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!canManagePersonnel(normalizeRole(actor?.role))) redirect('/staff/personnel')

  const roster = await getStaffRoster()
  const rows: ManageRow[] = roster.map((p) => ({
    id: p.id,
    name: p.name,
    dept: p.dept,
    dept_role: p.dept_role ?? null,
    position_title: p.position_title ?? null,
    role: p.role,
  }))

  return <ManageClient rows={rows} />
}
