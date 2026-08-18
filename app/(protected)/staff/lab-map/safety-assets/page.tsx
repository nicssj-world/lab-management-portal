import { redirect } from 'next/navigation'
import { SafetyAssetsClient } from '@/components/lab-map/SafetyAssetsClient'
import { requireSafetyViewer, isSafetyEditor, isSafetyManager } from '@/lib/lab-map/safety-access'
import { listAssemblyPoints, listSafetyAssets } from '@/lib/lab-map/safety-server'
import { getStaffLabMapDTO } from '@/lib/lab-map/server'
import { normalizeRole } from '@/lib/roles'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function SafetyAssetsPage({ searchParams }: {
  searchParams: Promise<{ inspectionRound?: string | string[] | undefined }>
}) {
  const params = await searchParams
  const rawInspectionRound = params.inspectionRound
  const initialInspectionRoundId = Array.isArray(rawInspectionRound) ? rawInspectionRound[0] ?? null : rawInspectionRound ?? null
  const guard = await requireSafetyViewer()
  if (guard.response || !guard.actor) redirect('/login')
  const isAdmin = normalizeRole(guard.actor.role) === 'Admin'
  const [map, assets, points, editorRows, staffRows] = await Promise.all([
    getStaffLabMapDTO(), listSafetyAssets(false), listAssemblyPoints(false),
    supabaseAdmin.from('lab_map_safety_editors').select('user_id'),
    isAdmin
      ? supabaseAdmin.from('profiles').select('id, name, role').order('name')
      : Promise.resolve({ data: [], error: null }),
  ])
  return <SafetyAssetsClient
    map={{ ...map, safetyEquipment: assets, assemblyPoints: points }}
    initialAssets={assets}
    initialAssemblyPoints={points}
    canEdit={await isSafetyEditor(guard.actor)}
    canManage={isSafetyManager(guard.actor)}
    isAdmin={isAdmin}
    initialInspectionRoundId={initialInspectionRoundId}
    staff={(staffRows.data ?? []).map(row => ({ id: String(row.id), name: row.name as string | null, role: String(row.role) }))}
    initialEditors={(editorRows.data ?? []).map(row => ({ user_id: String(row.user_id) }))}
  />
}
