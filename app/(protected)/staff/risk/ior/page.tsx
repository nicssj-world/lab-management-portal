import { IncidentClient } from '@/components/risk/IncidentClient'
import { requireIncidentAccess } from '../page'

export default async function IncidentReportsPage() {
  const { actor, canEdit, canReview, canEscalate, canCloseIncident, canAccessRiskModule } = await requireIncidentAccess()
  return (
    <IncidentClient
      canEdit={canEdit}
      canReview={canReview}
      canEscalate={canEscalate}
      canClose={canCloseIncident}
      canAccessRiskModule={canAccessRiskModule}
      actorName={actor.name}
    />
  )
}
