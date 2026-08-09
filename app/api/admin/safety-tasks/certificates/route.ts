import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { z } from 'zod'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { isAllowedFileSignature } from '@/lib/external-quality/files'
import { validateSafetyEvidenceMetadata } from '@/lib/quality-tasks/safety'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { createSafetyCertificate, listSafetyCertificates } from '@/lib/quality-tasks/safety-server'
import { materializeCertificateRenewals } from '@/lib/quality-tasks/server'

const RENEWAL_WINDOW_DAYS = 90
const schema = z.object({
  certificateType: z.string().trim().min(1).max(160), documentNo: z.string().max(160).nullable(),
  holderName: z.string().trim().min(1).max(200), department: z.string().max(200).nullable(), issuedOn: z.string().date().nullable(),
  expiresOn: z.string().date().nullable(), noExpiry: z.boolean(), ownerId: z.string().uuid().nullable(),
  key: z.string().min(1), fileName: z.string().min(1).max(255),
}).superRefine((value, ctx) => {
  if (!value.noExpiry && !value.expiresOn) ctx.addIssue({ code: 'custom', path: ['expiresOn'], message: 'กรุณาระบุวันหมดอายุ หรือเลือกไม่มีวันหมดอายุ' })
})

export async function GET() {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    // Materialization is idempotent by certificate + expiry date; reminders are displayed at 90/60/30 days.
    await materializeCertificateRenewals(ctx.actor.id)
    return NextResponse.json({ certificates: await listSafetyCertificates(), renewalWindowDays: RENEWAL_WINDOW_DAYS })
  } catch (error) { return safetyTaskError(error) }
}

export async function POST(req: NextRequest) {
  const ctx = await safetyTaskContext('edit'); if (ctx.response) return ctx.response
  let key = ''
  try {
    const input = schema.parse(await req.json()); key = input.key
    if (!key.startsWith('safety-certificates/')) throw new Error('Invalid certificate key')
    const head = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    const contentType = head.ContentType ?? ''
    const sizeBytes = Number(head.ContentLength ?? 0)
    const check = validateSafetyEvidenceMetadata(input.fileName, contentType, sizeBytes)
    if (!check.ok) throw new Error(check.error)
    const probe = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: 'bytes=0-11' }))
    const bytes = new Uint8Array(await probe.Body!.transformToByteArray())
    if (!isAllowedFileSignature(contentType, bytes)) throw new Error('เนื้อหาไฟล์ไม่ตรงกับประเภทที่ระบุ')
    const id = await createSafetyCertificate(input, { key, fileName: input.fileName, contentType, sizeBytes }, ctx.actor)
    await materializeCertificateRenewals(ctx.actor.id)
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    if (key) await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {})
    return safetyTaskError(error)
  }
}
