import { redirect } from 'next/navigation'
import { SafetyEquipmentMap } from '@/components/lab-map/SafetyEquipmentMap'
import { createClient } from '@/lib/supabase/server'
import { getStaffLabMapDTO } from '@/lib/lab-map/server'

export const dynamic = 'force-dynamic'

export default async function SafetyEquipmentMapPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile?.role) redirect('/staff/dashboard')
  return <SafetyEquipmentMap map={await getStaffLabMapDTO()} />
}
