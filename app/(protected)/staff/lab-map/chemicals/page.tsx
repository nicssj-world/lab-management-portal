import { redirect } from 'next/navigation'
import { ChemicalSafetyHubClient } from '@/components/chemical-safety/ChemicalSafetyHubClient'
import { requireChemicalViewer } from '@/lib/chemical-safety/access'
import { getChemicalSafetyDashboard, getChemicalStorageLayout, listChemicalImportReview, listChemicalRegistry } from '@/lib/chemical-safety/repository'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function ChemicalSafetyPage() {
  const guard = await requireChemicalViewer()
  if (guard.response || !guard.actor) redirect('/login')
  const [dashboard, locations, registry, imports, scopes] = await Promise.all([
    getChemicalSafetyDashboard(), getChemicalStorageLayout('chemical-prep'), listChemicalRegistry(), listChemicalImportReview(),
    supabaseAdmin.from('chemical_role_scopes').select('unit_id, role').eq('user_id', guard.actor.id),
  ])
  const rows = scopes.data ?? []
  return <ChemicalSafetyHubClient dashboard={dashboard} locations={locations} registry={registry} imports={imports}
    canEditUnitIds={rows.filter(row=>row.role==='custodian').map(row=>row.unit_id)} canReviewUnitIds={rows.filter(row=>row.role==='reviewer').map(row=>row.unit_id)} />
}
