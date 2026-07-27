import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ChemicalSafetyHubClient } from '@/components/chemical-safety/ChemicalSafetyHubClient'
import { requireChemicalViewer } from '@/lib/chemical-safety/access'
import {
  getChemicalStorageLayout,
  listChemicalChangeRequests,
  listChemicalProductRecords,
  listChemicalRegistry,
} from '@/lib/chemical-safety/repository'
import { CHEMICAL_HUB_VIEW_IDS, normalizeNavigationValue, type ChemicalHubView } from '@/lib/navigation'
import { normalizeRole } from '@/lib/roles'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ChemicalUnitDTO } from '@/lib/chemical-safety/types'

export const dynamic = 'force-dynamic'

export default async function ChemicalSafetyPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const guard = await requireChemicalViewer()
  if (guard.response || !guard.actor) redirect('/login')
  const actor = guard.actor

  const { view } = await searchParams
  const activeView = normalizeNavigationValue<ChemicalHubView>(
    view ?? null,
    CHEMICAL_HUB_VIEW_IDS,
    'layout',
  )

  const [locations, registry, products, changeRequests, unitRows, scopes] = await Promise.all([
    getChemicalStorageLayout('chemical-prep'),
    listChemicalRegistry(),
    listChemicalProductRecords(),
    listChemicalChangeRequests(),
    supabaseAdmin.from('chemical_units').select('id, code, name_th, active, created_at').eq('active', true).order('name_th'),
    supabaseAdmin.from('chemical_role_scopes').select('unit_id, role').eq('user_id', actor.id),
  ])

  const units: ChemicalUnitDTO[] = (unitRows.data ?? []).map(row => ({
    id: String(row.id),
    code: String(row.code),
    nameTh: String(row.name_th),
    active: Boolean(row.active),
    createdAt: String(row.created_at),
  }))
  const rows = scopes.data ?? []

  // สิทธิ์จริงตอนนี้คือ Admin เท่านั้น (chemicalAccessDecision ไม่ดู chemical_role_scopes เลย)
  // ต้องส่ง isAdmin ไปด้วย ไม่งั้นปุ่มเสนอ/ทบทวนจะไม่ขึ้นเลยตราบใดที่ตาราง scope ยังว่างอยู่
  const isAdmin = normalizeRole(actor.role) === 'Admin'

  return (
    // ViewTabs และ client ใช้ useSearchParams จึงต้องมี Suspense คั่นตอน prerender
    <Suspense fallback={null}>
      <ChemicalSafetyHubClient
        view={activeView}
        locations={locations}
        registry={registry}
        products={products}
        changeRequests={changeRequests}
        units={units}
        actorId={actor.id}
        isAdmin={isAdmin}
        canProposeUnitIds={rows.filter(row => row.role === 'custodian').map(row => row.unit_id)}
        canReviewUnitIds={rows.filter(row => row.role === 'reviewer').map(row => row.unit_id)}
      />
    </Suspense>
  )
}
