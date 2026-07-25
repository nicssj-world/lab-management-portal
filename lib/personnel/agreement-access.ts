import { canManagePersonnel } from '@/lib/personnel/roles'
import type { DeptRole } from '@/lib/supabase/types'

export function canManageAgreementCampaigns(role: string | null | undefined): boolean {
  return canManagePersonnel(role)
}

export function canApproveAgreementCampaign(deptRole: DeptRole | null | undefined): boolean {
  return deptRole === 'group_lead'
}

export function canViewAgreementCampaigns(
  role: string | null | undefined,
  deptRole: DeptRole | null | undefined,
): boolean {
  return canManageAgreementCampaigns(role) || canApproveAgreementCampaign(deptRole)
}
