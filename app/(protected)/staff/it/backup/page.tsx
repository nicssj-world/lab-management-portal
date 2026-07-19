import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPermissionsWithItOverride } from '@/lib/permissions'
import { getItBackupLogs, getItSystems } from '@/lib/queries/it-access'
import { ItBackupClient } from './ItBackupClient'

export const dynamic = 'force-dynamic'

export default async function ItBackupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const perms = actor?.role ? await getPermissionsWithItOverride(actor.role, user!.id) : {}
  if ((perms['ระบบสารสนเทศ (IT)'] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms['ระบบสารสนเทศ (IT)'] === 'edit'

  const [logs, systems, profilesRes] = await Promise.all([
    getItBackupLogs(supabaseAdmin),
    getItSystems(supabaseAdmin),
    supabaseAdmin.from('profiles').select('id, name').is('deleted_at', null).order('name'),
  ])

  return <ItBackupClient initialLogs={logs} systems={systems} profiles={profilesRes.data ?? []} canEdit={canEdit} />
}
