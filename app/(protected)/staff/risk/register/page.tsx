import { RegisterClient } from '@/components/risk/RegisterClient'
import { requireRiskAccess } from '../page'

export default async function RiskRegisterPage() {
  const { actor, canEdit, canReview, canCloseRegister } = await requireRiskAccess()
  return <RegisterClient canEdit={canEdit} canReview={canReview} canClose={canCloseRegister} actorName={actor.name} />
}
