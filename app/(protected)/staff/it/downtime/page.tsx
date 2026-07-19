import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPermissionsWithItOverride } from '@/lib/permissions'
import { getItDowntimeLogs, getItSystems } from '@/lib/queries/it-access'
import { ItDowntimeClient } from './ItDowntimeClient'

export const dynamic = 'force-dynamic'

export default async function ItDowntimePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const perms = actor?.role ? await getPermissionsWithItOverride(actor.role, user!.id) : {}
  if ((perms['ระบบสารสนเทศ (IT)'] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms['ระบบสารสนเทศ (IT)'] === 'edit'

  const [logs, systems] = await Promise.all([
    getItDowntimeLogs(supabaseAdmin),
    getItSystems(supabaseAdmin),
  ])

  return <ItDowntimeClient initialLogs={logs} systems={systems} canEdit={canEdit} />
}
