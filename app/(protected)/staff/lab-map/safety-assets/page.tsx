import { redirect } from 'next/navigation'
import { SafetyAssetsClient } from '@/components/lab-map/SafetyAssetsClient'
import { requireSafetyViewer, isSafetyEditor, isSafetyManager } from '@/lib/lab-map/safety-access'
import { listSafetyAssets } from '@/lib/lab-map/safety-server'
import { getStaffLabMapDTO } from '@/lib/lab-map/server'

export default async function SafetyAssetsPage({ searchParams }: {
  searchParams: Promise<{ inspectionRound?: string | string[] | undefined }>
}) {
  const params = await searchParams
  const rawInspectionRound = params.inspectionRound
  const initialInspectionRoundId = Array.isArray(rawInspectionRound) ? rawInspectionRound[0] ?? null : rawInspectionRound ?? null
  const guard = await requireSafetyViewer()
  if (guard.response || !guard.actor) redirect('/login')
  const [map, assets] = await Promise.all([
    getStaffLabMapDTO({ includeSafetyEquipment: false, includeAssemblyPoints: false }), listSafetyAssets(false),
  ])
  return <SafetyAssetsClient
    map={{ ...map, safetyEquipment: assets, assemblyPoints: [] }}
    initialAssets={assets}
    canEdit={await isSafetyEditor(guard.actor)}
    canManage={await isSafetyManager(guard.actor)}
    initialInspectionRoundId={initialInspectionRoundId}
  />
}
