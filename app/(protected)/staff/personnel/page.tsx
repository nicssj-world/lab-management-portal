import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRolePermissions } from '@/lib/permissions'
import { getStaffRoster, getAllCertifications, getAllCompetencies } from '@/lib/queries/personnel'
import { expiryStatus } from '@/lib/personnel/expiry'
import { createStaffSignedUrl } from '@/lib/personnel/storage'
import { PersonnelClient, type RosterRow } from './PersonnelClient'
import { hasMedicalTechnologistLicenseScope, canManagePersonnel } from '@/lib/personnel/roles'
import { normalizeRole } from '@/lib/roles'

export default async function PersonnelPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams
  const initialSummaryFilter = ['all', 'license-expiring', 'license-expired', 'license-missing', 'comp-overdue', 'comp-due-soon'].includes(filter ?? '')
    ? filter as import('@/lib/personnel/filters').PersonnelSummaryFilter
    : 'all'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['บุคลากร'] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canManage = canManagePersonnel(normalizeRole(actor?.role))

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

  // Official photos live in the private staff-files bucket and need a signed URL each;
  // fall back to the public display avatar when no official photo has been uploaded yet.
  const officialPhotoUrls = await Promise.all(
    roster.map((p) => (p.official_photo_url ? createStaffSignedUrl(p.official_photo_url) : Promise.resolve(null))),
  )

  const rows: RosterRow[] = roster.map((p, i) => {
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
      photo_url: officialPhotoUrls[i] ?? p.avatar_url ?? null,
      licenseStatus: hasMtLicenseScope ? expiryStatus(p.mt_license_expiry) : 'none',
      certExpiring: certByProfile.get(p.id)?.expiring ?? 0,
      certExpired: certByProfile.get(p.id)?.expired ?? 0,
      compOverdue: compByProfile.get(p.id)?.overdue ?? 0,
      compDueSoon: compByProfile.get(p.id)?.dueSoon ?? 0,
    }
  })

  return <PersonnelClient rows={rows} currentUserId={user.id} initialSummaryFilter={initialSummaryFilter} canManage={canManage} />
}
