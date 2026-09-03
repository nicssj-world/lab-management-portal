import { notFound, redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canEditVerificationRound, canViewVerificationRound, getVerificationRound } from '@/lib/it-verification/service'
import { canManageVerification, canReviewVerification, getItVerificationActor } from '@/lib/it-verification/guard'
import { getVerificationRoundDetail } from '@/lib/it-verification/queries'
import { VerificationDetailClient } from './VerificationDetailClient'

export const dynamic = 'force-dynamic'

export default async function ItVerificationDetailPage({ params }: { params: Promise<{ roundId: string }> }) {
  const actor = await getItVerificationActor()
  if (!actor) redirect('/login')
  const { roundId } = await params
  const permissions = await import('@/lib/permissions').then(({ getPermissionsWithItOverride }) => getPermissionsWithItOverride(actor.role, actor.id))
  if ((permissions['ทวนสอบการส่งผ่านข้อมูล HIS & LIS'] ?? 'none') === 'none') redirect('/staff/dashboard')

  const round = await getVerificationRound(roundId)
  if (!round) notFound()
  if (!(await canViewVerificationRound(actor, round))) redirect('/staff/it/verification')
  const detail = await getVerificationRoundDetail(roundId)
  if (!detail.round) notFound()
  const [uploadsRes, canEdit] = await Promise.all([
    supabaseAdmin.from('tat_uploads').select('id, year, month, file_name, row_count').eq('year', round.year).gte('month', (round.quarter - 1) * 3 + 1).lte('month', round.quarter * 3).order('month', { ascending: false }),
    canEditVerificationRound(actor, round),
  ])

  return (
    <VerificationDetailClient
      initialDetail={detail}
      initialUploads={uploadsRes.data ?? []}
      canEdit={canEdit}
      canManage={canManageVerification(actor)}
      canReview={canReviewVerification(actor)}
    />
  )
}
