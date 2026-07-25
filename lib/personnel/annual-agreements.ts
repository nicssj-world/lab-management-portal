import { z } from 'zod'

export const AGREEMENT_TYPES = ['confidentiality', 'impartiality'] as const
export type AgreementType = (typeof AGREEMENT_TYPES)[number]
export type AgreementRecipientStatus = 'pending' | 'completed' | 'certified' | 'exempt'
export type AgreementCampaignStatus = 'draft' | 'open' | 'approved'

export const DisclosureSchema = z.object({
  hasActivity: z.boolean(),
  activityName: z.string().trim().max(500).optional().default(''),
  activityDate: z.string().trim().max(100).optional().default(''),
  place: z.string().trim().max(500).optional().default(''),
  impacts: z.array(z.enum(['ability', 'integrity', 'fairness', 'decision'])).default([]),
  impactNotes: z.string().trim().max(2_000).optional().default(''),
})

export type DisclosureInput = z.infer<typeof DisclosureSchema>

export function fiscalYearBE(date = new Date()): number {
  const localMonth = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', month: 'numeric' }).format(date))
  const localYear = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(date))
  return localYear + (localMonth >= 10 ? 544 : 543)
}

export function validateDisclosure(input: Partial<DisclosureInput>): { ok: true } | { ok: false; error: string } {
  const parsed = DisclosureSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ข้อมูลการเปิดเผยกิจกรรมไม่ถูกต้อง' }
  const disclosure = parsed.data
  if (!disclosure.hasActivity) return { ok: true }
  if (!disclosure.activityName || !disclosure.activityDate || !disclosure.place || disclosure.impacts.length === 0) {
    return { ok: false, error: 'กรุณาระบุชื่อกิจกรรม วันเวลา สถานที่ และผลกระทบอย่างน้อย 1 รายการ' }
  }
  return { ok: true }
}

export function recipientStatus(input: {
  confidentialityAcceptedAt: string | null
  impartialityAcceptedAt: string | null
  disclosureAttestedAt: string | null
  exemptedAt?: string | null
}): AgreementRecipientStatus {
  if (input.exemptedAt) return 'exempt'
  if (input.confidentialityAcceptedAt && input.impartialityAcceptedAt && input.disclosureAttestedAt) return 'completed'
  return 'pending'
}

export function canApproveCampaign(recipients: Array<{ status: AgreementRecipientStatus }>) {
  return recipients.some((recipient) => recipient.status === 'completed')
}

export function canLockCampaign(recipients: Array<{ status: AgreementRecipientStatus }>) {
  return recipients.length > 0 && recipients.every((recipient) => recipient.status === 'certified' || recipient.status === 'exempt')
}

export function recipientsAwaitingCertification<T extends { status: AgreementRecipientStatus; certificationBatchId?: string | null }>(recipients: T[]) {
  return recipients.filter((recipient) => recipient.status === 'completed')
}

export function isAgreementCampaignOpen(input: { status: AgreementCampaignStatus; opensOn: string; dueOn: string }, now = new Date()) {
  if (input.status !== 'open') return false
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? ''
  const today = `${part('year')}-${part('month')}-${part('day')}`
  return today >= input.opensOn && today <= input.dueOn
}

export const CampaignCreateSchema = z.object({
  fiscalYear: z.number().int().min(2500).max(2700),
  title: z.string().trim().min(1).max(200),
  opensOn: z.string().date(),
  dueOn: z.string().date(),
  agreementDocumentId: z.string().uuid(),
  disclosureDocumentId: z.string().uuid(),
}).refine((value) => value.dueOn >= value.opensOn, {
  message: 'กำหนดส่งต้องไม่ก่อนวันเปิดรอบ',
  path: ['dueOn'],
})

export const ExemptionSchema = z.object({ reason: z.string().trim().min(1).max(1_000) })
