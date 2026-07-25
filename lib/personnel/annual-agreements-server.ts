import 'server-only'

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { downloadSignature, normalizeSignatureImage } from '@/lib/signatures'
import { canApproveCampaign, canLockCampaign, isAgreementCampaignOpen, recipientStatus, recipientsAwaitingCertification, validateDisclosure, type DisclosureInput } from '@/lib/personnel/annual-agreements'
import { generateAgreementEvidencePdf } from '@/lib/personnel/agreement-evidence-pdf'

export const AGREEMENT_BUCKET = 'staff-agreements'
const AGREEMENT_EVIDENCE_VERSION = 'fm-qp-lab-27-v8'

export type AgreementDocumentSnapshot = {
  id: string
  code: string
  title: string
  revision: string | null
  fileUrl: string | null
  publishedAt: string | null
  sha256: string
}

function hash(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

function plain(row: Record<string, unknown>) {
  return JSON.stringify(row, Object.keys(row).sort())
}

function evidenceVersionMarker(recipient: { status: string; certification_manifest_sha256?: string | null }) {
  if (recipient.status === 'certified') return `${AGREEMENT_EVIDENCE_VERSION}-certified-${recipient.certification_manifest_sha256?.slice(0, 16) || 'approved'}`
  return `${AGREEMENT_EVIDENCE_VERSION}-signed`
}

function approvalActorSnapshot(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const snapshot = value as Record<string, unknown>
  return {
    name: typeof snapshot.name === 'string' ? snapshot.name : null,
    position: typeof snapshot.positionTitle === 'string' ? snapshot.positionTitle : null,
  }
}

async function lockCampaignIfReady(campaignId: string) {
  const [{ data: campaign, error: campaignError }, { data: recipients, error: recipientsError }] = await Promise.all([
    supabaseAdmin.from('staff_agreement_campaigns').select('*').eq('id', campaignId).maybeSingle(),
    supabaseAdmin.from('staff_agreement_campaign_recipients').select('profile_id, status, evidence_sha256').eq('campaign_id', campaignId),
  ])
  if (campaignError || !campaign) throw campaignError ?? new Error('ไม่พบรอบข้อตกลง')
  if (recipientsError) throw recipientsError
  if (campaign.status !== 'open') return false
  if (!canLockCampaign((recipients ?? []) as Array<{ status: 'pending' | 'completed' | 'certified' | 'exempt' }>)) return false

  const lockedAt = new Date().toISOString()
  const manifest = hash(JSON.stringify({
    campaignId,
    fiscalYear: campaign.fiscal_year,
    recipients,
    lockedAt,
  }))
  const { error: updateError } = await supabaseAdmin.from('staff_agreement_campaigns').update({
    status: 'approved', locked_at: lockedAt, approval_manifest_sha256: manifest,
  }).eq('id', campaignId).eq('status', 'open')
  if (updateError) throw updateError
  void audit(campaign.created_by ?? 'system', 'personnel.agreements.campaign_auto_lock', campaignId, manifest)
  return true
}

export async function ensureAgreementBucket() {
  const { data } = await supabaseAdmin.storage.listBuckets()
  if (!data?.some((bucket) => bucket.id === AGREEMENT_BUCKET)) {
    const { error } = await supabaseAdmin.storage.createBucket(AGREEMENT_BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/png', 'application/pdf'],
    })
    if (error) throw error
  }
}

export async function snapshotPublishedDocument(documentId: string): Promise<AgreementDocumentSnapshot> {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('id, document_code, title, revision, file_url, published_at, updated_at, status')
    .eq('id', documentId)
    .is('deleted_at', null)
    .single()
  if (error || !data || data.status !== 'Published') throw new Error('เลือกได้เฉพาะเอกสารที่เผยแพร่แล้ว')
  const source = {
    id: data.id,
    code: data.document_code,
    title: data.title,
    revision: data.revision ?? null,
    fileUrl: data.file_url ?? null,
    publishedAt: data.published_at ?? null,
    updatedAt: data.updated_at,
  }
  return { ...source, sha256: hash(plain(source)) }
}

export async function copyAgreementSignature(input: {
  profileId: string
  campaignId: string
  method: 'drawn' | 'saved'
  drawnFile?: File | null
  namespace?: 'recipient' | 'approval'
}) {
  await ensureAgreementBucket()
  let bytes: Buffer
  if (input.method === 'saved') {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('signature_url')
      .eq('id', input.profileId)
      .maybeSingle()
    if (error || !data?.signature_url) throw new Error('ยังไม่มีลายเซ็นทางการที่บันทึกไว้')
    const saved = await downloadSignature(data.signature_url)
    if (!saved) throw new Error('ไม่สามารถอ่านลายเซ็นทางการที่บันทึกไว้ได้')
    bytes = Buffer.from(saved)
  } else {
    if (!input.drawnFile) throw new Error('กรุณาวาดหรือแนบลายเซ็นก่อนลงนาม')
    const normalized = await normalizeSignatureImage(input.drawnFile)
    bytes = normalized.buffer
  }
  const segment = input.namespace === 'approval' ? 'approvals' : 'signatures'
  const path = `${segment}/${input.campaignId}/${input.profileId}/${randomUUID()}.png`
  const { error } = await supabaseAdmin.storage
    .from(AGREEMENT_BUCKET)
    .upload(path, bytes, { contentType: 'image/png', upsert: false })
  if (error) throw error
  return { path, bytes }
}

export async function createAgreementCampaign(input: {
  fiscalYear: number
  title: string
  opensOn: string
  dueOn: string
  agreementDocumentId: string
  disclosureDocumentId: string
  actorId: string
}) {
  const [agreementDocument, disclosureDocument, activeProfiles] = await Promise.all([
    snapshotPublishedDocument(input.agreementDocumentId),
    snapshotPublishedDocument(input.disclosureDocumentId),
    supabaseAdmin.from('profiles').select('id').eq('status', 'active').is('deleted_at', null),
  ])
  if (activeProfiles.error) throw activeProfiles.error
  const { data: campaign, error } = await supabaseAdmin
    .from('staff_agreement_campaigns')
    .insert({
      fiscal_year: input.fiscalYear,
      title: input.title,
      opens_on: input.opensOn,
      due_on: input.dueOn,
      status: 'open',
      agreement_document_snapshot: agreementDocument,
      disclosure_document_snapshot: disclosureDocument,
      created_by: input.actorId,
      opened_at: new Date().toISOString(),
    })
    .select('*')
    .single()
  if (error || !campaign) throw error ?? new Error('สร้างรอบข้อตกลงไม่สำเร็จ')
  const targets = (activeProfiles.data ?? []).map((profile) => ({ campaign_id: campaign.id, profile_id: profile.id }))
  if (targets.length) {
    const { error: recipientsError } = await supabaseAdmin.from('staff_agreement_campaign_recipients').insert(targets)
    if (recipientsError) throw recipientsError
  }
  void audit(input.actorId, 'personnel.agreements.campaign_create', campaign.id, `FY ${input.fiscalYear}; targets ${targets.length}`)
  return campaign
}

export async function listAgreementCampaigns() {
  const { data, error } = await supabaseAdmin
    .from('staff_agreement_campaigns')
    .select('*')
    .order('fiscal_year', { ascending: false })
  if (error) throw error
  const campaigns = data ?? []
  if (!campaigns.length) return []
  const { data: recipients, error: recipientsError } = await supabaseAdmin
    .from('staff_agreement_campaign_recipients')
    .select('campaign_id, status')
    .in('campaign_id', campaigns.map((campaign) => campaign.id))
  if (recipientsError) throw recipientsError
  return campaigns.map((campaign) => {
    const rows = (recipients ?? []).filter((row) => row.campaign_id === campaign.id)
    return {
      ...campaign,
      counts: {
        total: rows.length,
        signed: rows.filter((row) => row.status === 'completed').length,
        certified: rows.filter((row) => row.status === 'certified').length,
        exempt: rows.filter((row) => row.status === 'exempt').length,
        pending: rows.filter((row) => row.status === 'pending').length,
      },
    }
  })
}

export async function campaignDetail(campaignId: string) {
  const [{ data: campaign, error: campaignError }, { data: recipients, error: recipientsError }, { data: disclosures, error: disclosuresError }] = await Promise.all([
    supabaseAdmin.from('staff_agreement_campaigns').select('*').eq('id', campaignId).maybeSingle(),
    supabaseAdmin.from('staff_agreement_campaign_recipients').select('*').eq('campaign_id', campaignId).order('status').order('profile_id'),
    supabaseAdmin.from('staff_activity_disclosures').select('*').eq('campaign_id', campaignId).order('attested_at', { ascending: false }),
  ])
  if (campaignError || !campaign) throw campaignError ?? new Error('ไม่พบรอบข้อตกลง')
  if (recipientsError) throw recipientsError
  if (disclosuresError) throw disclosuresError
  const profileIds = (recipients ?? []).map((recipient) => recipient.profile_id)
  const { data: profiles } = profileIds.length
    ? await supabaseAdmin.from('profiles').select('id, name, position_title, dept').in('id', profileIds)
    : { data: [] as Array<{ id: string; name: string; position_title: string | null; dept: string | null }> }
  const byProfile = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
  return {
    campaign,
    recipients: (recipients ?? []).map((recipient) => ({ ...recipient, profile: byProfile.get(recipient.profile_id) ?? null })),
    disclosures: disclosures ?? [],
  }
}

export async function deleteAgreementCampaign(campaignId: string, actorId: string) {
  const [{ data: campaign, error: campaignError }, { count: acknowledgementCount, error: acknowledgementError }] = await Promise.all([
    supabaseAdmin.from('staff_agreement_campaigns').select('id, status, fiscal_year').eq('id', campaignId).maybeSingle(),
    supabaseAdmin.from('staff_agreement_acknowledgements').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
  ])
  if (campaignError || !campaign) throw campaignError ?? new Error('ไม่พบรอบข้อตกลง')
  if (acknowledgementError) throw acknowledgementError
  if (campaign.status === 'approved') throw new Error('ไม่สามารถลบรอบที่รับรองแล้วได้')
  if ((acknowledgementCount ?? 0) > 0) throw new Error('ไม่สามารถลบรอบที่มีผู้ลงนามแล้วได้ เพื่อคงหลักฐานย้อนหลัง')
  const { error } = await supabaseAdmin.from('staff_agreement_campaigns').delete().eq('id', campaignId)
  if (error) throw error
  void audit(actorId, 'personnel.agreements.campaign_delete', campaignId, `FY ${campaign.fiscal_year}`)
}

export async function currentAgreementTask(profileId: string) {
  const { data: rows, error } = await supabaseAdmin
    .from('staff_agreement_campaign_recipients')
    .select('*, staff_agreement_campaigns(*)')
    .eq('profile_id', profileId)
  if (error) throw error
  const row = (rows ?? []).find((item: any) => {
    const campaign = item.staff_agreement_campaigns
    return campaign && isAgreementCampaignOpen({ status: campaign.status, opensOn: campaign.opens_on, dueOn: campaign.due_on })
  }) as any
  if (!row) return null
  const [acks, disclosure, signature] = await Promise.all([
    supabaseAdmin.from('staff_agreement_acknowledgements').select('agreement_type, accepted_at').eq('campaign_id', row.campaign_id).eq('profile_id', profileId),
    supabaseAdmin.from('staff_activity_disclosures').select('*').eq('campaign_id', row.campaign_id).eq('profile_id', profileId).maybeSingle(),
    supabaseAdmin.from('profiles').select('signature_url, signature_updated_at').eq('id', profileId).maybeSingle(),
  ])
  return { recipient: row, campaign: row.staff_agreement_campaigns, acknowledgements: acks.data ?? [], disclosure: disclosure.data ?? null, savedSignature: signature.data ?? null }
}

export async function listAgreementHistoryForProfile(profileId: string) {
  const [{ data, error }, { data: acknowledgements, error: acknowledgementsError }] = await Promise.all([
    supabaseAdmin
      .from('staff_agreement_campaign_recipients')
      .select('campaign_id, status, exempt_reason, completed_at, evidence_url, staff_agreement_campaigns(id, fiscal_year, title, status)')
      .eq('profile_id', profileId)
      .order('campaign_id'),
    supabaseAdmin
      .from('staff_agreement_acknowledgements')
      .select('campaign_id, agreement_type, accepted_at')
      .eq('profile_id', profileId),
  ])
  if (error) throw error
  if (acknowledgementsError) throw acknowledgementsError
  const acknowledgementsByCampaign = new Map<string, Record<string, string>>()
  for (const acknowledgement of acknowledgements ?? []) {
    const accepted = acknowledgementsByCampaign.get(acknowledgement.campaign_id) ?? {}
    accepted[acknowledgement.agreement_type] = acknowledgement.accepted_at
    acknowledgementsByCampaign.set(acknowledgement.campaign_id, accepted)
  }
  return (data ?? [])
    .map((row: any) => {
      const campaign = row.staff_agreement_campaigns
      if (!campaign) return null
      const accepted = acknowledgementsByCampaign.get(row.campaign_id) ?? {}
      return {
        campaignId: row.campaign_id as string,
        fiscalYear: campaign.fiscal_year as number,
        title: campaign.title as string,
        campaignStatus: campaign.status as 'draft' | 'open' | 'approved',
        status: row.status as 'pending' | 'completed' | 'certified' | 'exempt',
        completedAt: row.completed_at as string | null,
        confidentialityAcceptedAt: accepted.confidentiality ?? null,
        impartialityAcceptedAt: accepted.impartiality ?? null,
        exemptReason: row.exempt_reason as string | null,
        hasEvidence: Boolean(row.evidence_url),
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.fiscalYear - a.fiscalYear)
}

export async function submitAgreementTask(input: {
  campaignId: string
  profileId: string
  signingMethod: 'drawn' | 'saved'
  drawnFile?: File | null
  disclosure: DisclosureInput
}) {
  const validation = validateDisclosure(input.disclosure)
  if (!validation.ok) throw new Error(validation.error)
  const { data: campaign, error: campaignError } = await supabaseAdmin.from('staff_agreement_campaigns').select('*').eq('id', input.campaignId).maybeSingle()
  if (campaignError || !campaign || !isAgreementCampaignOpen({ status: campaign.status, opensOn: campaign.opens_on, dueOn: campaign.due_on })) throw new Error('รอบข้อตกลงนี้ปิดแล้วหรือไม่อยู่ในช่วงลงนาม')
  const { data: recipient, error: recipientError } = await supabaseAdmin
    .from('staff_agreement_campaign_recipients')
    .select('*').eq('campaign_id', input.campaignId).eq('profile_id', input.profileId).maybeSingle()
  if (recipientError || !recipient || recipient.status !== 'pending') throw new Error('รายการนี้ไม่พร้อมลงนาม')

  const { path: signaturePath, bytes: signatureBytes } = await copyAgreementSignature({
    profileId: input.profileId, campaignId: input.campaignId, method: input.signingMethod, drawnFile: input.drawnFile,
  })
  const now = new Date().toISOString()
  const agreementDocument = campaign.agreement_document_snapshot as AgreementDocumentSnapshot
  const disclosureDocument = campaign.disclosure_document_snapshot as AgreementDocumentSnapshot
  const acknowledgements = ['confidentiality', 'impartiality'].map((agreement_type) => ({
    campaign_id: input.campaignId, profile_id: input.profileId, agreement_type,
    document_snapshot: agreementDocument, accepted_at: now, signed_by: input.profileId,
    signing_method: input.signingMethod, signature_snapshot_url: signaturePath,
  }))
  const { error: ackError } = await supabaseAdmin.from('staff_agreement_acknowledgements').insert(acknowledgements)
  if (ackError) throw ackError
  const { error: disclosureError } = await supabaseAdmin.from('staff_activity_disclosures').insert({
    campaign_id: input.campaignId, profile_id: input.profileId,
    has_activity: input.disclosure.hasActivity,
    activity_name: input.disclosure.hasActivity ? input.disclosure.activityName : null,
    activity_date: input.disclosure.hasActivity ? input.disclosure.activityDate : null,
    place: input.disclosure.hasActivity ? input.disclosure.place : null,
    impacts: input.disclosure.hasActivity ? input.disclosure.impacts : [],
    impact_notes: input.disclosure.hasActivity ? input.disclosure.impactNotes : null,
    document_snapshot: disclosureDocument, attested_at: now, signed_by: input.profileId,
    signing_method: input.signingMethod, signature_snapshot_url: signaturePath,
  })
  if (disclosureError) throw disclosureError
  const { data: profile } = await supabaseAdmin.from('profiles').select('name, position_title').eq('id', input.profileId).single()
  const evidence = await generateAgreementEvidencePdf({
    fiscalYear: campaign.fiscal_year,
    employeeName: profile?.name ?? '-', employeePosition: profile?.position_title ?? null, acceptedAt: now,
    agreementDocument, disclosureDocument, disclosure: input.disclosure, signingMethod: input.signingMethod, signaturePng: signatureBytes,
  })
  const evidencePath = `evidence/${input.campaignId}/${input.profileId}/${evidenceVersionMarker({ status: 'completed' })}-${randomUUID()}.pdf`
  const { error: uploadError } = await supabaseAdmin.storage.from(AGREEMENT_BUCKET).upload(evidencePath, evidence, { contentType: 'application/pdf', upsert: false })
  if (uploadError) throw uploadError
  const { error: completionError } = await supabaseAdmin.from('staff_agreement_campaign_recipients').update({
    status: recipientStatus({ confidentialityAcceptedAt: now, impartialityAcceptedAt: now, disclosureAttestedAt: now }),
    completed_at: now, evidence_url: evidencePath, evidence_sha256: hash(evidence),
  }).eq('campaign_id', input.campaignId).eq('profile_id', input.profileId).eq('status', 'pending')
  if (completionError) throw completionError
  void audit(input.profileId, 'personnel.agreements.submit', input.campaignId, `${input.signingMethod}; disclosure=${input.disclosure.hasActivity}`)
  return { evidencePath }
}

export async function refreshAgreementEvidence(campaignId: string, profileId: string) {
  const [{ data: campaign, error: campaignError }, { data: recipient, error: recipientError }] = await Promise.all([
    supabaseAdmin.from('staff_agreement_campaigns').select('*').eq('id', campaignId).maybeSingle(),
    supabaseAdmin.from('staff_agreement_campaign_recipients').select('*').eq('campaign_id', campaignId).eq('profile_id', profileId).maybeSingle(),
  ])
  if (campaignError || !campaign) throw campaignError ?? new Error('ไม่พบรอบข้อตกลง')
  if (recipientError || !recipient || !['completed', 'certified'].includes(recipient.status)) throw recipientError ?? new Error('ไม่พบหลักฐานข้อตกลง')
  const versionMarker = evidenceVersionMarker(recipient)
  if (recipient.evidence_url?.includes(`/${versionMarker}-`)) return recipient.evidence_url as string

  const [{ data: acknowledgements, error: acknowledgementsError }, { data: disclosure, error: disclosureError }, { data: profile, error: profileError }, { data: approverProfile, error: approverProfileError }] = await Promise.all([
    supabaseAdmin.from('staff_agreement_acknowledgements').select('*').eq('campaign_id', campaignId).eq('profile_id', profileId),
    supabaseAdmin.from('staff_activity_disclosures').select('*').eq('campaign_id', campaignId).eq('profile_id', profileId).maybeSingle(),
    supabaseAdmin.from('profiles').select('name, position_title').eq('id', profileId).maybeSingle(),
    recipient.certified_by && recipient.certified_at
      ? supabaseAdmin.from('profiles').select('name, position_title').eq('id', recipient.certified_by).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (acknowledgementsError) throw acknowledgementsError
  if (disclosureError || !disclosure) throw disclosureError ?? new Error('ไม่พบข้อมูลการเปิดเผยกิจกรรม')
  if (profileError || !profile) throw profileError ?? new Error('ไม่พบบุคลากร')
  if (approverProfileError) throw approverProfileError
  const acknowledgement = (acknowledgements ?? []).find((row) => row.agreement_type === 'confidentiality') ?? acknowledgements?.[0]
  if (!acknowledgement?.signature_snapshot_url) throw new Error('ไม่พบลายเซ็นที่ใช้ลงนาม')

  const [{ data: signatureFile, error: signatureError }, approvalSignature] = await Promise.all([
    supabaseAdmin.storage.from(AGREEMENT_BUCKET).download(acknowledgement.signature_snapshot_url),
    recipient.certification_signature_url && recipient.certified_at
      ? supabaseAdmin.storage.from(AGREEMENT_BUCKET).download(recipient.certification_signature_url)
      : Promise.resolve({ data: null, error: null }),
  ])
  if (signatureError || !signatureFile) throw signatureError ?? new Error('ไม่สามารถอ่านลายเซ็นที่ใช้ลงนามได้')
  if (approvalSignature.error) throw approvalSignature.error
  const signatureBytes = new Uint8Array(await signatureFile.arrayBuffer())
  const approvalSignatureBytes = approvalSignature.data ? new Uint8Array(await approvalSignature.data.arrayBuffer()) : null
  const agreementDocument = (acknowledgement.document_snapshot ?? campaign.agreement_document_snapshot) as AgreementDocumentSnapshot
  const disclosureDocument = (disclosure.document_snapshot ?? campaign.disclosure_document_snapshot) as AgreementDocumentSnapshot
  const approvalSnapshot = approvalActorSnapshot(recipient.certification_actor_snapshot)
  const approver = recipient.certified_at
    ? {
        name: approvalSnapshot?.name ?? approverProfile?.name ?? 'หัวหน้ากลุ่มงาน',
        position: approvalSnapshot?.position ?? approverProfile?.position_title ?? null,
        approvedAt: recipient.certified_at,
        signaturePng: approvalSignatureBytes,
      }
    : undefined
  const evidence = await generateAgreementEvidencePdf({
    fiscalYear: campaign.fiscal_year,
    employeeName: profile.name,
    employeePosition: profile.position_title,
    acceptedAt: acknowledgement.accepted_at ?? recipient.completed_at,
    agreementDocument,
    disclosureDocument,
    disclosure: {
      hasActivity: disclosure.has_activity,
      activityName: disclosure.activity_name,
      activityDate: disclosure.activity_date,
      place: disclosure.place,
      impacts: disclosure.impacts ?? [],
      impactNotes: disclosure.impact_notes,
    },
    signingMethod: acknowledgement.signing_method,
    signaturePng: signatureBytes,
    approver,
  })
  const evidencePath = `evidence/${campaignId}/${profileId}/${versionMarker}-${randomUUID()}.pdf`
  const { error: uploadError } = await supabaseAdmin.storage.from(AGREEMENT_BUCKET).upload(evidencePath, evidence, { contentType: 'application/pdf', upsert: false })
  if (uploadError) throw uploadError
  const { error: updateError } = await supabaseAdmin.from('staff_agreement_campaign_recipients').update({
    evidence_url: evidencePath,
    evidence_sha256: hash(evidence),
  }).eq('campaign_id', campaignId).eq('profile_id', profileId).eq('status', recipient.status)
  if (updateError) throw updateError
  return evidencePath
}

export async function exemptAgreementRecipient(campaignId: string, profileId: string, reason: string, actorId: string) {
  const { data: campaign } = await supabaseAdmin.from('staff_agreement_campaigns').select('status').eq('id', campaignId).maybeSingle()
  if (!campaign || campaign.status !== 'open') throw new Error('รอบข้อตกลงนี้ล็อกแล้ว')
  const { error } = await supabaseAdmin.from('staff_agreement_campaign_recipients').update({
    status: 'exempt', exempt_reason: reason, exempted_at: new Date().toISOString(), exempted_by: actorId,
  }).eq('campaign_id', campaignId).eq('profile_id', profileId).eq('status', 'pending')
  if (error) throw error
  await lockCampaignIfReady(campaignId)
  void audit(actorId, 'personnel.agreements.exempt', profileId, reason)
}

export async function approveAgreementCampaign(input: {
  campaignId: string
  actorId: string
  signingMethod: 'drawn' | 'saved'
  drawnFile?: File | null
}) {
  const [{ data: campaign }, { data: approver, error: approverError }] = await Promise.all([
    supabaseAdmin.from('staff_agreement_campaigns').select('*').eq('id', input.campaignId).maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('name, position_title, dept_role')
      .eq('id', input.actorId)
      .is('deleted_at', null)
      .maybeSingle(),
  ])
  if (!campaign || campaign.status !== 'open') throw new Error('รอบข้อตกลงนี้ล็อกแล้ว')
  if (approverError || !approver) throw approverError ?? new Error('ไม่พบข้อมูลผู้รับรอง')
  if (approver.dept_role !== 'group_lead') throw new Error('เฉพาะหัวหน้ากลุ่มงานเท่านั้นที่รับรองรอบข้อตกลงได้')
  const { data: recipients, error } = await supabaseAdmin.from('staff_agreement_campaign_recipients').select('profile_id, status, evidence_sha256').eq('campaign_id', input.campaignId)
  if (error) throw error
  const waitingRecipients = recipientsAwaitingCertification((recipients ?? []) as Array<{ profile_id: string; status: 'pending' | 'completed' | 'certified' | 'exempt'; evidence_sha256: string | null; certificationBatchId?: string | null }>)
  if (!canApproveCampaign((recipients ?? []) as Array<{ status: 'pending' | 'completed' | 'certified' | 'exempt' }>) || waitingRecipients.length === 0) throw new Error('ไม่มีรายการที่ลงนามแล้วรอรับรอง')
  const { path } = await copyAgreementSignature({
    profileId: input.actorId, campaignId: input.campaignId, method: input.signingMethod, drawnFile: input.drawnFile, namespace: 'approval',
  })
  const now = new Date().toISOString()
  const approverSnapshot = {
    name: approver.name,
    positionTitle: approver.position_title,
    deptRole: approver.dept_role,
  }
  const batchId = randomUUID()
  const manifest = hash(JSON.stringify({
    campaignId: input.campaignId,
    fiscalYear: campaign.fiscal_year,
    recipients: waitingRecipients,
    certifiedAt: now,
    certifiedBy: input.actorId,
    approver: approverSnapshot,
  }))
  const { error: updateError } = await supabaseAdmin.from('staff_agreement_campaign_recipients').update({
    status: 'certified',
    certification_batch_id: batchId,
    certified_at: now,
    certified_by: input.actorId,
    certification_actor_snapshot: approverSnapshot,
    certification_signature_url: path,
    certification_signature_method: input.signingMethod,
    certification_manifest_sha256: manifest,
  }).eq('campaign_id', input.campaignId).eq('status', 'completed').in('profile_id', waitingRecipients.map((recipient) => recipient.profile_id))
  if (updateError) throw updateError
  await Promise.all(waitingRecipients.map((recipient) => refreshAgreementEvidence(input.campaignId, recipient.profile_id)))
  const locked = await lockCampaignIfReady(input.campaignId)
  void audit(input.actorId, 'personnel.agreements.certify_batch', input.campaignId, `${batchId}; ${waitingRecipients.length} people; ${manifest}`)
  return { locked, certifiedCount: waitingRecipients.length }
}

export async function createAgreementSignedUrl(path: string | null | undefined) {
  if (!path) return null
  const { data, error } = await supabaseAdmin.storage.from(AGREEMENT_BUCKET).createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data?.signedUrl ?? null
}

async function audit(actorId: string, action: string, target: string, detail?: string) {
  await supabaseAdmin.from('audit_log').insert({ action, user_id: actorId, target, detail: detail ?? null }).then(() => undefined, () => undefined)
}
