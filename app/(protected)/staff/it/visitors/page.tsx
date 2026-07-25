import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { isAdminRole } from '@/lib/roles'
import { getItVisitorLogs } from '@/lib/queries/it-access'
import { getVisitorFormSettings } from '@/lib/it-visitor/public-server'
import { VISITOR_RESOURCE } from '@/lib/it-visitor/guard'
import { ItVisitorsClient } from './ItVisitorsClient'

export const dynamic = 'force-dynamic'

export default async function ItVisitorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  // resource แยกจาก 'ระบบสารสนเทศ (IT)' — ทุก role ยกเว้น Assistant เห็นได้
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms[VISITOR_RESOURCE] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms[VISITOR_RESOURCE] === 'edit'
  const isAdmin = isAdminRole(actor?.role)

  const [logs, settings] = await Promise.all([
    getItVisitorLogs(supabaseAdmin),
    getVisitorFormSettings(),
  ])

  return (
    <ItVisitorsClient
      initialLogs={logs}
      initialSettings={settings}
      canEdit={canEdit}
      isAdmin={isAdmin}
    />
  )
}
