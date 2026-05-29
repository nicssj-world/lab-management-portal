import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRolePermissions } from '@/lib/permissions'
import { getEquipment } from '@/lib/queries/equipment'
import EquipmentClient from './EquipmentClient'

export default async function EquipmentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms['ทะเบียนเครื่องมือ'] === 'edit'

  const initialData = await getEquipment(supabase)

  const lastUpdated = initialData.length > 0
    ? initialData.reduce((max, e) => e.created_at > max ? e.created_at : max, initialData[0].created_at)
    : null

  return <EquipmentClient initialData={initialData} canEdit={canEdit} lastUpdated={lastUpdated} />
}
