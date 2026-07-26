import { RiskMapClient } from '@/components/risk/RiskMapClient'
import { getStaffLabMapDTO } from '@/lib/lab-map/server'
import { requireRiskAccess } from '../page'

export default async function RiskMapPage() {
  await requireRiskAccess()
  return <RiskMapClient map={await getStaffLabMapDTO()} />
}
