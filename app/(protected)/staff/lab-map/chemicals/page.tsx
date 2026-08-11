import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ChemicalSafetyHubClient } from '@/components/chemical-safety/ChemicalSafetyHubClient'
import type { SdsProductInfo } from '@/components/chemical-safety/SdsManagementClient'
import { requireChemicalViewer } from '@/lib/chemical-safety/access'
import { canManageDepartmentSds } from '@/lib/chemical-safety/department-access'
import { listDepartmentSds } from '@/lib/chemical-safety/department-repository'
import { CHEMICAL_SDS_DEPARTMENTS } from '@/lib/chemical-safety/departments'
import {
  getChemicalStorageLayout,
  listChemicalRooms,
  listChemicalChangeRequests,
  listChemicalProductRecords,
  listChemicalRegistry,
  listInternalSds,
} from '@/lib/chemical-safety/repository'
import { CHEMICAL_HUB_VIEW_IDS, normalizeNavigationValue, type ChemicalHubView } from '@/lib/navigation'
import { isSafetyEditor } from '@/lib/lab-map/safety-access'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ChemicalRoomDTO, ChemicalUnitDTO, GhsPictogramCode } from '@/lib/chemical-safety/types'

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
    'registry',
  )

  const [locations, rooms, registry, products, changeRequests, unitRows, scopes, sdsItems, roomSdsItems, departmentSds, sdsProductRows] = await Promise.all([
    getChemicalStorageLayout('chemical-prep'),
    listChemicalRooms(),
    listChemicalRegistry(),
    listChemicalProductRecords(),
    listChemicalChangeRequests(),
    supabaseAdmin.from('chemical_units').select('id, code, name_th, active, created_at').eq('active', true).order('name_th'),
    supabaseAdmin.from('chemical_role_scopes').select('unit_id, role').eq('user_id', actor.id),
    listInternalSds(),
    listInternalSds({}, 'room'),
    listDepartmentSds(),
    supabaseAdmin
      .from('chemical_products')
      .select('id, canonical_name, ghs_pictogram_codes, ghs_hazard_classes')
      .eq('lifecycle_status', 'active'),
  ])

  const units: ChemicalUnitDTO[] = (unitRows.data ?? []).map(row => ({
    id: String(row.id),
    code: String(row.code),
    nameTh: String(row.name_th),
    active: Boolean(row.active),
    createdAt: String(row.created_at),
  }))
  const chemicalRooms: ChemicalRoomDTO[] = rooms
  const rows = scopes.data ?? []

  // Safety Editor ของแผนที่ห้องปฏิบัติการจัดการสารเคมีและ SDS ได้ทั้งโมดูล
  const canManageChemicals = await isSafetyEditor(actor)
  const sdsProducts: SdsProductInfo[] = (sdsProductRows.data ?? []).map(row => ({
    productId: String(row.id),
    name: String(row.canonical_name),
    pictogramCodes: Array.isArray(row.ghs_pictogram_codes)
      ? (row.ghs_pictogram_codes as string[]).filter((code): code is GhsPictogramCode => typeof code === 'string')
      : [],
    hazardClassesTh: Array.isArray(row.ghs_hazard_classes)
      ? (row.ghs_hazard_classes as Array<Record<string, unknown>>)
        .filter(hazard => hazard && typeof hazard.class_th === 'string')
        .map(hazard => String(hazard.class_th))
      : [],
  }))
  const publishableDepartmentCodes = (await Promise.all(
    CHEMICAL_SDS_DEPARTMENTS.map(async department => (
      await canManageDepartmentSds(actor, department.code) ? department.code : null
    )),
  )).filter((code): code is string => code !== null)

  return (
    // ViewTabs และ client ใช้ useSearchParams จึงต้องมี Suspense คั่นตอน prerender
    <Suspense fallback={null}>
      <ChemicalSafetyHubClient
        view={activeView}
        locations={locations}
        rooms={chemicalRooms}
        registry={registry}
        products={products}
        changeRequests={changeRequests}
        units={units}
        actorId={actor.id}
        canManageChemicals={canManageChemicals}
        canProposeUnitIds={rows.filter(row => row.role === 'custodian').map(row => row.unit_id)}
        canReviewUnitIds={rows.filter(row => row.role === 'reviewer').map(row => row.unit_id)}
        sdsItems={sdsItems}
        roomSdsItems={roomSdsItems}
        sdsProducts={sdsProducts}
        departmentSds={departmentSds}
        publishableDepartmentCodes={publishableDepartmentCodes}
      />
    </Suspense>
  )
}
