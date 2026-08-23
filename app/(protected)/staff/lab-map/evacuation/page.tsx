import { redirect } from 'next/navigation'
import { EvacuationClient } from '@/components/lab-map/EvacuationClient'
import { getEvacuationDashboard } from '@/lib/lab-map/evacuation-server'
import { isSafetyEditor, isSafetyManager, requireSafetyViewer } from '@/lib/lab-map/safety-access'

export const dynamic = 'force-dynamic'

export default async function EvacuationPage() {
  const guard = await requireSafetyViewer()
  if (guard.response || !guard.actor) redirect('/login')
  const canEdit = await isSafetyEditor(guard.actor)
  const dashboard = await getEvacuationDashboard(guard.actor.id, canEdit ? 'edit' : 'view')
  return <EvacuationClient initialDashboard={dashboard} canEdit={canEdit} canManage={isSafetyManager(guard.actor)} />
}
