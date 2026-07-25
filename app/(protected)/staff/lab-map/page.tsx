import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LabMapStaffClient } from '@/components/lab-map/LabMapStaffClient'
import { createClient } from '@/lib/supabase/server'
import { getRolePermissions } from '@/lib/permissions'
import { getStaffLabMapDTO } from '@/lib/lab-map/server'

export default async function StaffLabMapPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile?.role) redirect('/staff/dashboard')
  const permissions = await getRolePermissions(profile.role)
  const map = await getStaffLabMapDTO({ permissions })
  return <><div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}><Link href="/staff/lab-map/print">ส่งออก A3/A4 PDF หรือ PNG</Link></div><LabMapStaffClient map={map} /></>
}
