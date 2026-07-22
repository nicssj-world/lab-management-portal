import { IncidentClient } from '@/components/risk/IncidentClient'
import { requireRiskAccess } from '../page'

export default async function IncidentReportsPage() {
  const { actor, canEdit, canReview } = await requireRiskAccess()
  return <IncidentClient canEdit={canEdit} canReview={canReview} actorName={actor.name} />
}
