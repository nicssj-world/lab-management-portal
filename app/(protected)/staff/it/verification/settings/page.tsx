import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getItVerificationActor, canManageVerification } from '@/lib/it-verification/guard'
import { getVerificationSummary } from '@/lib/it-verification/queries'
import { IT_DEPARTMENTS } from '@/lib/it-verification/domain'
import { getPermissionsWithItOverride } from '@/lib/permissions'
import { VerificationSettingsClient } from './VerificationSettingsClient'

export const dynamic = 'force-dynamic'

export default async function ItVerificationSettingsPage() {
  const actor = await getItVerificationActor()
  if (!actor) redirect('/login')
  const permissions = await getPermissionsWithItOverride(actor.role, actor.id)
  if ((permissions['ทวนสอบการส่งผ่านข้อมูล HIS & LIS'] ?? 'none') === 'none') redirect('/staff/dashboard')
  if (!canManageVerification(actor)) redirect('/staff/it/verification')

  const year = new Date().getFullYear()
  const quarter = Math.ceil((new Date().getMonth() + 1) / 3)
  const [mappingRes, peopleRes, summary] = await Promise.all([
    supabaseAdmin.from('it_verification_section_map').select('id, source_lab_section, department_id, is_active').order('source_lab_section'),
    supabaseAdmin.from('profiles').select('id, name, dept').eq('status', 'active').is('deleted_at', null).order('name'),
    getVerificationSummary(year, quarter, actor),
  ])
  return <VerificationSettingsClient initialMappings={mappingRes.data ?? []} profiles={peopleRes.data ?? []} departments={IT_DEPARTMENTS} summary={summary} year={year} quarter={quarter} />
}
