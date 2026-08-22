import { randomBytes } from 'node:crypto'
import type {
  SurveyCampaign,
  SurveyCampaignEffectiveStatus,
  SurveyCampaignStatus,
} from './types'

export const SURVEY_TIME_ZONE = 'Asia/Bangkok' as const

export type ThaiFiscalYearPeriod = {
  fiscalYear: number
  opensAt: string
  closesAt: string
  periodStart: string
  periodEnd: string
}

export type CampaignUpdatePolicyPatch = {
  fiscalYear?: number
  departmentId?: number
  targetResponseCount?: number | null
  kpiMetricCode?: string
  responseLimit?: number | null
  onePerDevice?: boolean
  status?: SurveyCampaignStatus
}

export function thaiFiscalYearPeriod(fiscalYear: number): ThaiFiscalYearPeriod {
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2500 || fiscalYear > 3000) {
    throw new Error('ปีงบประมาณต้องอยู่ระหว่าง 2500–3000')
  }
  const gregorianEndYear = fiscalYear - 543
  const periodStart = `${gregorianEndYear - 1}-10-01`
  const periodEnd = `${gregorianEndYear}-09-30`
  return {
    fiscalYear,
    opensAt: new Date(`${periodStart}T00:00:00+07:00`).toISOString(),
    closesAt: new Date(`${gregorianEndYear}-10-01T00:00:00+07:00`).toISOString(),
    periodStart,
    periodEnd,
  }
}

export function campaignDisplayName(fiscalYear: number, departmentName: string) {
  return `รอบปีงบประมาณ ${fiscalYear} (${departmentName.trim()})`
}

export function campaignEffectiveStatus(
  campaign: Pick<SurveyCampaign, 'status' | 'opensAt' | 'closesAt'>,
  now = new Date(),
): SurveyCampaignEffectiveStatus {
  if (campaign.status === 'draft') return 'draft'
  if (campaign.status === 'closed') return 'closed'
  if (campaign.opensAt && new Date(campaign.opensAt).getTime() > now.getTime()) return 'scheduled'
  if (campaign.closesAt && new Date(campaign.closesAt).getTime() <= now.getTime()) {
    return 'expired_pending_close'
  }
  return 'open'
}

export type CampaignAvailability =
  | { available: true; code: 'open' }
  | {
      available: false
      code: 'draft' | 'closed' | 'scheduled' | 'expired' | 'limit_reached' | 'duplicate'
    }

export function campaignAvailability(
  campaign: SurveyCampaign,
  now: Date,
  responseCount: number,
  duplicateDevice: boolean,
): CampaignAvailability {
  if (campaign.status === 'draft') return { available: false, code: 'draft' }
  if (campaign.status === 'closed') return { available: false, code: 'closed' }
  if (campaign.opensAt && new Date(campaign.opensAt).getTime() > now.getTime()) {
    return { available: false, code: 'scheduled' }
  }
  if (campaign.closesAt && new Date(campaign.closesAt).getTime() <= now.getTime()) {
    return { available: false, code: 'expired' }
  }
  if (campaign.responseLimit !== null && responseCount >= campaign.responseLimit) {
    return { available: false, code: 'limit_reached' }
  }
  if (campaign.onePerDevice && duplicateDevice) {
    return { available: false, code: 'duplicate' }
  }
  return { available: true, code: 'open' }
}

export function createPublicToken() {
  return randomBytes(32).toString('base64url')
}

export function assertCampaignTransition(
  current: SurveyCampaignStatus,
  next: SurveyCampaignStatus,
) {
  if (current === 'closed' && next !== 'closed') {
    throw new Error('รอบเก็บข้อมูลที่ปิดแล้วไม่สามารถเปิดใหม่ได้')
  }
  if (current === 'draft' && next === 'closed') {
    throw new Error('ฉบับร่างต้องเปิดรับคำตอบก่อนจึงจะปิดได้')
  }
  if (current === 'open' && next === 'draft') {
    throw new Error('รอบที่เปิดรับคำตอบแล้วไม่สามารถเปลี่ยนกลับเป็นฉบับร่างได้')
  }
}

export function assertCampaignUpdatePolicy(
  current: SurveyCampaign,
  patch: CampaignUpdatePolicyPatch,
  now = new Date(),
) {
  if (patch.status) assertCampaignTransition(current.status, patch.status)
  if (current.status === 'closed') {
    throw new Error('รอบเก็บข้อมูลที่ปิดแล้วไม่สามารถแก้ไขได้')
  }

  const effectiveKpiCode = patch.kpiMetricCode ?? current.kpiMetricCode
  if (patch.status === 'closed' && !effectiveKpiCode) {
    throw new Error('กรุณากำหนด KPI ก่อนปิดรอบเก็บข้อมูล')
  }

  if (current.status === 'open') {
    const lockedFields: Array<keyof CampaignUpdatePolicyPatch> = [
      'fiscalYear',
      'departmentId',
      'responseLimit',
      'onePerDevice',
    ]
    if (lockedFields.some((field) => patch[field] !== undefined)) {
      throw new Error('รอบที่เปิดรับคำตอบแล้วแก้ไขข้อมูลรอบไม่ได้ ยกเว้นเป้าหมายจำนวนคำตอบ')
    }
    if (patch.kpiMetricCode !== undefined && current.kpiMetricCode !== null) {
      throw new Error('รอบที่เปิดรับคำตอบแล้วไม่สามารถเปลี่ยนชุด KPI ได้')
    }
  }

  if (patch.status === 'open') {
    if (!effectiveKpiCode) throw new Error('กรุณากำหนด KPI ก่อนเปิดรับคำตอบ')
    const fiscalYear = patch.fiscalYear ?? current.fiscalYear
    if (fiscalYear === null) throw new Error('กรุณากำหนดปีงบประมาณก่อนเปิดรับคำตอบ')
    if ((patch.departmentId ?? current.departmentId) === null) {
      throw new Error('กรุณากำหนดหน่วยงานก่อนเปิดรับคำตอบ')
    }
    if (new Date(thaiFiscalYearPeriod(fiscalYear).closesAt).getTime() <= now.getTime()) {
      throw new Error('ไม่สามารถเปิดรอบที่สิ้นสุดปีงบประมาณแล้ว')
    }
  }
}
