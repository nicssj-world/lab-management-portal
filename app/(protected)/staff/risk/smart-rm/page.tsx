import { SmartRmClient } from '@/components/risk/SmartRmClient'
import { requireRiskAccess } from '../page'

export default async function SmartRmPage() {
  const { canEdit } = await requireRiskAccess()
  return <SmartRmClient canEdit={canEdit} />
}
