import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPermissionsWithEquipmentOverride } from '@/lib/permissions'
import {
  getEquipmentClassifications,
  getEquipmentDepartments,
  getEquipmentLastUpdated,
  getEquipmentPage,
  getEquipmentSummaryCounts,
  getEquipmentStatusCounts,
} from '@/lib/queries/equipment'
import EquipmentClient from './EquipmentClient'

const INITIAL_PAGE_SIZE = 50

interface EquipmentPageSearchParams {
  create?: string
  area?: string
  unpositioned?: string
  open?: string
  panel?: string
}

export default async function EquipmentPage({ searchParams }: { searchParams: Promise<EquipmentPageSearchParams> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const perms = actor?.role ? await getPermissionsWithEquipmentOverride(actor.role, user!.id) : {}
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms['ทะเบียนเครื่องมือ'] === 'edit'

  const [initialPage, departments, classifications, statusCounts, summaryCounts, lastUpdated] = await Promise.all([
    getEquipmentPage(supabase, { page: 1, pageSize: INITIAL_PAGE_SIZE }),
    getEquipmentDepartments(supabase),
    getEquipmentClassifications(supabase),
    getEquipmentStatusCounts(supabase),
    getEquipmentSummaryCounts(supabase),
    getEquipmentLastUpdated(supabase),
  ])

  const { create, area, unpositioned, open, panel } = await searchParams
  return (
    <EquipmentClient
      initialData={initialPage.items}
      initialTotal={initialPage.count}
      initialPageSize={initialPage.pageSize}
      departments={departments}
      classifications={classifications}
      statusCounts={statusCounts}
      initialSummaryCounts={summaryCounts}
      canEdit={canEdit}
      lastUpdated={lastUpdated}
      initialCreate={create === '1'}
      initialArea={area ?? ''}
      initialUnpositioned={unpositioned === '1' || unpositioned === 'true'}
      initialOpenId={open ?? null}
      initialPanel={panel ?? null}
    />
  )
}
