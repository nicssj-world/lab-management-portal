import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getStaffRoster, getAllCompetencies } from '@/lib/queries/personnel'
import { expiryStatus } from '@/lib/personnel/expiry'
import { canManagePersonnel } from '@/lib/personnel/roles'
import { normalizeRole } from '@/lib/roles'
import { ManageClient, type ManageRow, type CompStat, type WorkGroup } from './ManageClient'

export default async function PersonnelManagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!canManagePersonnel(normalizeRole(actor?.role))) redirect('/staff/personnel')

  const [roster, comps, { data: cats }, { data: wg }] = await Promise.all([
    getStaffRoster(),
    getAllCompetencies(),
    supabaseAdmin.from('categories').select('th').order('th'),
    supabaseAdmin.from('personnel_work_groups').select('*').order('created_at', { ascending: true }),
  ])
  const rows: ManageRow[] = roster.map((p) => ({
    id: p.id,
    name: p.name,
    dept: p.dept,
    dept_role: p.dept_role ?? null,
    is_section_head: p.is_section_head ?? false,
    position_title: p.position_title ?? null,
    role: p.role,
  }))
  const categories = (cats ?? []).map((c) => c.th as string)
  const workGroups = (wg ?? []) as WorkGroup[]

  // Per-person competency due status (overdue / due soon) for the section dashboard.
  const compStats: Record<string, CompStat> = {}
  for (const c of comps) {
    const s = expiryStatus(c.next_due_date)
    if (s !== 'expiring' && s !== 'expired') continue
    const cur = compStats[c.profile_id] ?? { overdue: 0, dueSoon: 0 }
    if (s === 'expired') cur.overdue++
    else cur.dueSoon++
    compStats[c.profile_id] = cur
  }

  return <ManageClient rows={rows} categories={categories} compStats={compStats} workGroups={workGroups} />
}
