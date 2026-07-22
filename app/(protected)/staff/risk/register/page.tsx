import { RegisterClient } from '@/components/risk/RegisterClient'
import { requireRiskAccess } from '../page'

export default async function RiskRegisterPage() {
  const { actor, canEdit, canReview } = await requireRiskAccess()
  return <RegisterClient canEdit={canEdit} canReview={canReview} actorName={actor.name} />
}
