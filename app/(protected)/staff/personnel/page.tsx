import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRolePermissions } from '@/lib/permissions'
import { getStaffRoster, getAllCertifications, getAllCompetencies } from '@/lib/queries/personnel'
import { expiryStatus } from '@/lib/personnel/expiry'
import { PersonnelClient, type RosterRow } from './PersonnelClient'
import { hasMedicalTechnologistLicenseScope } from '@/lib/personnel/roles'

export default async function PersonnelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['บุคลากร'] ?? 'none') === 'none') redirect('/staff/dashboard')

  const [roster, certs, comps] = await Promise.all([
    getStaffRoster(),
    getAllCertifications(),
    getAllCompetencies(),
  ])

  // Aggregate per-staff status for the roster + summary cards
  const certByProfile = new Map<string, { expiring: number; expired: number }>()
  for (const c of certs) {
    const s = expiryStatus(c.expiry_date)
    if (s !== 'expiring' && s !== 'expired') continue
    const cur = certByProfile.get(c.profile_id) ?? { expiring: 0, expired: 0 }
    if (s === 'expiring') cur.expiring++
    else cur.expired++
    certByProfile.set(c.profile_id, cur)
  }
  const compByProfile = new Map<string, { overdue: number; dueSoon: number }>()
  for (const c of comps) {
    const s = expiryStatus(c.next_due_date)
    if (s !== 'expiring' && s !== 'expired') continue
    const cur = compByProfile.get(c.profile_id) ?? { overdue: 0, dueSoon: 0 }
    if (s === 'expired') cur.overdue++
    else cur.dueSoon++
    compByProfile.set(c.profile_id, cur)
  }

  const rows: RosterRow[] = roster.map((p) => {
    const hasMtLicenseScope = hasMedicalTechnologistLicenseScope(p.role)
    return {
      id: p.id,
      name: p.name,
      ephis_id: p.ephis_id ?? null,
      role: p.role,
      dept: p.dept,
      unit: p.unit ?? null,
      position_title: p.position_title ?? null,
      mt_license_no: hasMtLicenseScope ? p.mt_license_no ?? null : null,
      mt_license_expiry: hasMtLicenseScope ? p.mt_license_expiry ?? null : null,
      avatar_url: p.avatar_url ?? null,
      licenseStatus: hasMtLicenseScope ? expiryStatus(p.mt_license_expiry) : 'none',
      certExpiring: certByProfile.get(p.id)?.expiring ?? 0,
      certExpired: certByProfile.get(p.id)?.expired ?? 0,
      compOverdue: compByProfile.get(p.id)?.overdue ?? 0,
      compDueSoon: compByProfile.get(p.id)?.dueSoon ?? 0,
    }
  })

  return <PersonnelClient rows={rows} />
}
