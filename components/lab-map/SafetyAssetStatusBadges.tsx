import { Badge } from '@/components/ui/Badge'
import { getSafetyAssetStatusBadges } from '@/lib/lab-map/safety-status-badges'
import type { SafetyAssetDTO } from '@/lib/lab-map/types'

export function SafetyAssetStatusBadges({ item }: { item: SafetyAssetDTO }) {
  const badges = getSafetyAssetStatusBadges(item)

  return <span className="safety-card-badges" aria-label="สถานะอุปกรณ์">
    {badges.map(badge => <Badge key={`${badge.key}-${badge.label}`} color={badge.color}>{badge.label}</Badge>)}
  </span>
}
