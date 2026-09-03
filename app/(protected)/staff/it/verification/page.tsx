import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canManageVerification, getItVerificationActor } from '@/lib/it-verification/guard'
import { getVerificationSummary } from '@/lib/it-verification/queries'
import { getPermissionsWithItOverride } from '@/lib/permissions'
import { VerificationOverviewClient } from './VerificationOverviewClient'

export const dynamic = 'force-dynamic'

export default async function ItVerificationPage() {
  const actor = await getItVerificationActor()
  if (!actor) redirect('/login')
  const permissions = await getPermissionsWithItOverride(actor.role, actor.id)
  if ((permissions['ทวนสอบการส่งผ่านข้อมูล HIS & LIS'] ?? 'none') === 'none') redirect('/staff/dashboard')

  const year = new Date().getFullYear()
  const quarter = Math.ceil((new Date().getMonth() + 1) / 3)
  const [summary, uploadsRes] = await Promise.all([
    getVerificationSummary(year, quarter, actor),
    supabaseAdmin.from('tat_uploads').select('id, year, month, file_name, row_count').order('year', { ascending: false }).order('month', { ascending: false }).limit(24),
  ])

  return (
    <VerificationOverviewClient
      initialSummary={summary}
      initialYear={year}
      initialQuarter={quarter}
      initialUploads={uploadsRes.data ?? []}
      canManage={canManageVerification(actor)}
    />
  )
}
