import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { SdsManagementClient, type SdsProductInfo } from '@/components/chemical-safety/SdsManagementClient'
import { requireChemicalViewer } from '@/lib/chemical-safety/access'
import { canPublishDepartmentSds } from '@/lib/chemical-safety/department-access'
import { listDepartmentSds } from '@/lib/chemical-safety/department-repository'
import { CHEMICAL_SDS_DEPARTMENTS } from '@/lib/chemical-safety/departments'
import { listInternalSds } from '@/lib/chemical-safety/repository'
import { CHEMICAL_SDS_VIEW_IDS, normalizeNavigationValue, type ChemicalSdsView } from '@/lib/navigation'
import { normalizeRole } from '@/lib/roles'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { GhsPictogramCode } from '@/lib/chemical-safety/types'

export const dynamic = 'force-dynamic'

export default async function SdsManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const guard = await requireChemicalViewer()
  if (guard.response || !guard.actor) redirect('/login')
  const actor = guard.actor

  const { view } = await searchParams
  const activeView = normalizeNavigationValue<ChemicalSdsView>(
    view ?? null,
    CHEMICAL_SDS_VIEW_IDS,
    'chemicals',
  )

  const [items, departments, scopes, productRows] = await Promise.all([
    listInternalSds(),
    listDepartmentSds(),
    supabaseAdmin.from('chemical_role_scopes').select('unit_id, role').eq('user_id', actor.id),
    supabaseAdmin
      .from('chemical_products')
      .select('id, canonical_name, ghs_pictogram_codes, ghs_hazard_classes')
      .eq('lifecycle_status', 'active'),
  ])

  const rows = scopes.data ?? []

  // ส่งการจำแนกจากบัญชีรายการสารเคมีไปด้วย เพื่อให้ฟอร์มแก้ไขเติมค่าเริ่มต้นให้ผู้ทบทวนได้
  const products: SdsProductInfo[] = (productRows.data ?? []).map(row => ({
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

  const publishableDepartmentCodes = CHEMICAL_SDS_DEPARTMENTS
    .filter(department => canPublishDepartmentSds(actor, department.code))
    .map(department => department.code)

  // สิทธิ์จริงตอนนี้คือ Admin เท่านั้น (chemicalAccessDecision ไม่สนใจ chemical_role_scopes เลย)
  // จึงต้องส่ง isAdmin ไปด้วย ไม่งั้นปุ่มแก้ไข/ส่งทบทวน/อนุมัติจะไม่ขึ้นเลยตราบใดที่ตาราง
  // chemical_role_scopes ยังว่างอยู่ — ทำให้ Admin เข้าถึง API ได้แต่กดอะไรใน UI ไม่ได้เลย
  const isAdmin = normalizeRole(actor.role) === 'Admin'

  return (
    // ViewTabs ใช้ useSearchParams จึงต้องมี Suspense คั่นตอน prerender
    <Suspense fallback={null}>
      <SdsManagementClient
        view={activeView}
        items={items}
        products={products}
        departments={departments}
        actorId={actor.id}
        isAdmin={isAdmin}
        canEditUnitIds={rows.filter(row => row.role === 'custodian').map(row => row.unit_id)}
        canReviewUnitIds={rows.filter(row => row.role === 'reviewer').map(row => row.unit_id)}
        publishableDepartmentCodes={publishableDepartmentCodes}
      />
    </Suspense>
  )
}
