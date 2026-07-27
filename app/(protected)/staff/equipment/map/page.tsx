import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPermissionsWithEquipmentOverride } from '@/lib/permissions'
import { getEquipmentMapDTO } from '@/lib/equipment-map/server'
import { EquipmentMapClient } from '@/components/equipment-map/EquipmentMapClient'

export default async function EquipmentMapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const perms = actor?.role ? await getPermissionsWithEquipmentOverride(actor.role, user!.id) : {}
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms['ทะเบียนเครื่องมือ'] === 'edit'

  const map = await getEquipmentMapDTO()

  return <EquipmentMapClient map={map} canEdit={canEdit} />
}
