import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LabMapStaffClient } from '@/components/lab-map/LabMapStaffClient'
import { Icon } from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/server'
import { getStaffLabMapDTO } from '@/lib/lab-map/server'

export default async function StaffLabMapPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile?.role) redirect('/staff/dashboard')
  const map = await getStaffLabMapDTO()
  return (
    <LabMapStaffClient
      map={map}
      headerActions={(
        <Link
          href="/staff/lab-map/print"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
        >
          <Icon name="download" size={15} /> ส่งออก A3/A4 PDF หรือ PNG
        </Link>
      )}
    />
  )
}
