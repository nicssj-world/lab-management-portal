import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRolePermissions } from '@/lib/permissions'
import {
  getEquipmentDepartments,
  getEquipmentLastUpdated,
  getEquipmentPage,
  getEquipmentStatusCounts,
} from '@/lib/queries/equipment'
import EquipmentClient from './EquipmentClient'

const INITIAL_PAGE_SIZE = 50

export default async function EquipmentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms['ทะเบียนเครื่องมือ'] === 'edit'

  const [initialPage, departments, statusCounts, lastUpdated] = await Promise.all([
    getEquipmentPage(supabase, { page: 1, pageSize: INITIAL_PAGE_SIZE }),
    getEquipmentDepartments(supabase),
    getEquipmentStatusCounts(supabase),
    getEquipmentLastUpdated(supabase),
  ])

  return (
    <EquipmentClient
      initialData={initialPage.items}
      initialTotal={initialPage.count}
      initialPageSize={initialPage.pageSize}
      departments={departments}
      statusCounts={statusCounts}
      canEdit={canEdit}
      lastUpdated={lastUpdated}
    />
  )
}
