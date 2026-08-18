import type { BadgeColor } from '@/components/ui/Badge'
import type { SafetyAssetDTO, SafetyInspectionDTO } from './types'

export interface SafetyAssetStatusBadge {
  key: 'result' | 'position' | 'schedule' | 'status'
  label: string
  color: BadgeColor
}

type SafetyStatusBadgeInput = Pick<SafetyAssetDTO, 'operationalStatus' | 'positionStatus'> & {
  latestInspection?: Pick<SafetyInspectionDTO, 'result'> | null
}

const RESULT_BADGES: Record<SafetyInspectionDTO['result'], SafetyAssetStatusBadge> = {
  passed: { key: 'result', label: 'ผ่าน', color: 'green' },
  needs_attention: { key: 'result', label: 'ต้องติดตาม', color: 'amber' },
  failed: { key: 'result', label: 'ไม่พร้อมใช้', color: 'red' },
  not_found: { key: 'result', label: 'ไม่พบอุปกรณ์', color: 'red' },
}

const OPERATIONAL_BADGES: Record<NonNullable<SafetyAssetDTO['operationalStatus']>, SafetyAssetStatusBadge> = {
  unverified: { key: 'position', label: 'รอยืนยันตำแหน่ง', color: 'amber' },
  verified: { key: 'position', label: 'ยืนยันตำแหน่งแล้ว', color: 'blue' },
  passed: { key: 'status', label: 'ผ่าน', color: 'green' },
  needs_attention: { key: 'status', label: 'ต้องติดตาม', color: 'amber' },
  failed: { key: 'status', label: 'ไม่พร้อมใช้', color: 'red' },
  overdue: { key: 'schedule', label: 'เกินกำหนดตรวจ', color: 'red' },
  due_soon: { key: 'schedule', label: 'ใกล้ครบกำหนด', color: 'amber' },
}

export function getSafetyAssetStatusBadges(input: SafetyStatusBadgeInput): SafetyAssetStatusBadge[] {
  const latestResult = input.latestInspection?.result
  const badges: SafetyAssetStatusBadge[] = []

  if (latestResult) badges.push(RESULT_BADGES[latestResult])

  if (input.positionStatus === 'unverified') {
    badges.push(OPERATIONAL_BADGES.unverified)
  }

  if (input.operationalStatus === 'due_soon' || input.operationalStatus === 'overdue') {
    badges.push(OPERATIONAL_BADGES[input.operationalStatus])
  }

  if (!latestResult && input.operationalStatus && input.operationalStatus !== 'unverified'
    && input.operationalStatus !== 'due_soon' && input.operationalStatus !== 'overdue') {
    badges.push(OPERATIONAL_BADGES[input.operationalStatus])
  }

  if (!latestResult && !input.operationalStatus && input.positionStatus === 'verified') {
    badges.push(OPERATIONAL_BADGES.verified)
  }

  return badges
}
