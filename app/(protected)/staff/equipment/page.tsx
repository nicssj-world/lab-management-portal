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

export default async function EquipmentPage() {
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
    />
  )
}
