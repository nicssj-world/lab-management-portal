import sharp from 'sharp'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { PDFDocument } from 'pdf-lib'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { downloadSignature } from '@/lib/signatures'
import { DEFAULT_DOCUMENT_AUDIENCE, isCoverRequiredType } from '@/lib/documents/workflow'
import { generateQualityCoverPdf, mergeCoverWithPdf, type CoverPerson } from '@/lib/documents/cover-pdf'

const COVER_TEMPLATE_VERSION = 'quality-cover-v1'

type PersonProfile = {
  id: string
  name: string | null
  role: string | null
  doc_role: string | null
  document_position: string | null
  signature_url: string | null
}

type PublishDocument = {
  id: string
  document_code: string
  title: string
  type: string
  department: string | null
  revision: string | null
  owner_id: string | null
  reviewer_id: string | null
  approver_id: string | null
  approved_by_id: string | null
  owner_name: string | null
  reviewer_name: string | null
  approver_name: string | null
  file_url: string | null
  file_name: string | null
  source_pdf_url: string | null
  source_pdf_name: string | null
  edit_date: string | null
  approved_at: string | null
  effective_date: string | null
  audience_text: string | null
}

function rolePositionFallback(profile: PersonProfile | null) {
  const role = profile?.doc_role || profile?.role || ''
  if (role === 'Document Controller') return 'Document Controller'
  if (role === 'Quality Manager') return 'Quality Manager'
  if (role === 'Laboratory Director') return 'Laboratory Director'
  if (role === 'Reviewer') return 'Reviewer'
  return profile?.role ?? ''
}

async function getObjectBytes(key: string) {
  const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  const body = object.Body
  if (!body) throw new Error('ไม่พบไฟล์ PDF เนื้อหาใน R2')
  if ('transformToByteArray' in body && typeof body.transformToByteArray === 'function') {
    return await body.transformToByteArray()
  }
  const chunks: Uint8Array[] = []
  for await (const chunk of body as AsyncIterable<Uint8Array | Buffer>) {
    chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk))
  }
  return Buffer.concat(chunks).subarray()
}

async function loadProfile(id: string | null | undefined): Promise<PersonProfile | null> {
  if (!id) return null
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, name, role, doc_role, document_position, signature_url')
    .eq('id', id)
    .maybeSingle()
  return (data ?? null) as PersonProfile | null
}

async function loadProfileByName(name: string | null | undefined): Promise<PersonProfile | null> {
  const clean = name?.trim()
  if (!clean) return null
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, name, role, doc_role, document_position, signature_url')
    .eq('name', clean)
    .maybeSingle()
  return (data ?? null) as PersonProfile | null
}

async function loadSignature(profile: PersonProfile | null) {
  const signaturePath = profile?.signature_url ?? null
  const bytes = await downloadSignature(signaturePath)
  if (!bytes) return { bytes: null, type: null }

  const ext = signaturePath?.split('.').pop()?.toLowerCase()
  if (ext === 'webp') {
    const png = await sharp(Buffer.from(bytes)).png().toBuffer()
    return { bytes: new Uint8Array(png), type: 'image/png' }
  }
  return {
    bytes,
    type: ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png',
  }
}

async function coverPerson(profile: PersonProfile | null, fallbackName: string | null | undefined): Promise<CoverPerson> {
  const signature = await loadSignature(profile)
  return {
    name: fallbackName ?? profile?.name ?? '',
    position: profile?.document_position ?? rolePositionFallback(profile),
    signatureBytes: signature.bytes,
    signatureType: signature.type,
  }
}

export async function buildPublishedPdfFields(documentId: string, overrides: Record<string, unknown> = {}) {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('id, document_code, title, type, department, revision, owner_id, reviewer_id, approver_id, approved_by_id, owner_name, reviewer_name, approver_name, file_url, file_name, source_pdf_url, source_pdf_name, edit_date, approved_at, effective_date, audience_text')
    .eq('id', documentId)
    .single()

  if (error || !data) throw new Error(error?.message ?? 'ไม่พบเอกสาร')
  const doc = { ...(data as PublishDocument), ...overrides } as PublishDocument
  if (!isCoverRequiredType(doc.type)) return null

  const contentKey = doc.source_pdf_url || doc.file_url
  if (!contentKey) throw new Error('QP/WI ต้องมี PDF เนื้อหาก่อน Published')
  const contentBytes = await getObjectBytes(contentKey)

  const ownerProfile = await loadProfileByName(doc.owner_name) || (!doc.owner_name ? await loadProfile(doc.owner_id) : null)
  const reviewerProfile = await loadProfile(doc.reviewer_id) || await loadProfileByName(doc.reviewer_name)
  const approverProfile = await loadProfile(doc.approver_id || doc.approved_by_id) || await loadProfileByName(doc.approver_name)
  const [owner, reviewer, approver] = await Promise.all([
    coverPerson(ownerProfile, doc.owner_name),
    coverPerson(reviewerProfile, doc.reviewer_name),
    coverPerson(approverProfile, doc.approver_name),
  ])

  const pageCount = (await PDFDocument.load(contentBytes)).getPageCount() + 1

  const coverMetadata = {
    template_version: COVER_TEMPLATE_VERSION,
    generated_at: new Date().toISOString(),
    document_code: doc.document_code,
    title: doc.title,
    type: doc.type,
    department: doc.department,
    revision: doc.revision,
    edit_date: doc.edit_date,
    approved_at: doc.approved_at,
    effective_date: doc.effective_date,
    audience_text: doc.audience_text || DEFAULT_DOCUMENT_AUDIENCE,
    owner: { id: ownerProfile?.id ?? null, name: owner.name, position: owner.position, signature_url: ownerProfile?.signature_url ?? null },
    reviewer: { id: reviewerProfile?.id ?? null, name: reviewer.name, position: reviewer.position, signature_url: reviewerProfile?.signature_url ?? null },
    approver: { id: approverProfile?.id ?? null, name: approver.name, position: approver.position, signature_url: approverProfile?.signature_url ?? null },
  }

  const coverPdf = await generateQualityCoverPdf({
    documentCode: doc.document_code,
    title: doc.title,
    type: doc.type,
    department: doc.department,
    revision: doc.revision,
    pageCount,
    editDate: doc.edit_date,
    approvedAt: doc.approved_at,
    effectiveDate: doc.effective_date,
    audienceText: doc.audience_text,
    owner,
    reviewer,
    approver,
  })
  const finalPdf = await mergeCoverWithPdf(coverPdf, contentBytes)
  const safeCode = doc.document_code.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `documents/generated/${doc.id}/${Date.now()}-${safeCode}-final.pdf`

  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: Buffer.from(finalPdf),
    ContentType: 'application/pdf',
  }))

  return {
    file_url: key,
    file_name: `${doc.document_code}.pdf`,
    file_size: finalPdf.length,
    mime_type: 'application/pdf',
    cover_template_version: COVER_TEMPLATE_VERSION,
    cover_generated_at: coverMetadata.generated_at,
    cover_metadata: coverMetadata,
  }
}
