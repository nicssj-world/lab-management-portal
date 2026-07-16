import { randomBytes } from 'node:crypto'
import type { SurveyCampaign, SurveyCampaignStatus } from './types'

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
}
