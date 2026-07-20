import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPermissionsWithItOverride } from '@/lib/permissions'
import { isAdminRole } from '@/lib/roles'
import { canApproveItReview } from '@/lib/it-access/guard'
import { getItAccessRecords, getItSystems, getLatestItAccessReview } from '@/lib/queries/it-access'
import { ItAccessClient } from './ItAccessClient'

export const dynamic = 'force-dynamic'

export default async function ItAccessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase.from('profiles').select('role, doc_role').eq('id', user!.id).single()
  const perms = actor?.role ? await getPermissionsWithItOverride(actor.role, user!.id) : {}
  if ((perms['ระบบสารสนเทศ (IT)'] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms['ระบบสารสนเทศ (IT)'] === 'edit'
  // Only a real Admin (not an IT-editor override) may grant/revoke the override itself.
  const isAdmin = isAdminRole(actor?.role)
  // Approving the annual review is narrower than IT edit — Admin or Laboratory Director only.
  const canApprove = canApproveItReview({ role: actor?.role ?? '', doc_role: actor?.doc_role ?? null })

  const [records, systems, latestReview, profilesRes] = await Promise.all([
    getItAccessRecords(supabaseAdmin),
    getItSystems(supabaseAdmin),
    getLatestItAccessReview(supabaseAdmin),
    supabaseAdmin
      .from('profiles')
      .select('id, name, position_title, ephis_id')
      .is('deleted_at', null)
      .order('name'),
  ])

  return (
    <ItAccessClient
      initialRecords={records}
      initialSystems={systems}
      latestReview={latestReview}
      profiles={profilesRes.data ?? []}
      canEdit={canEdit}
      isAdmin={isAdmin}
      canApprove={canApprove}
    />
  )
}
