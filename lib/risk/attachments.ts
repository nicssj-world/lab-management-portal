import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { r2ObjectResponse } from '@/lib/r2/stream-response'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { contentDispositionForExternalQualityAttachment } from '@/lib/external-quality/content-disposition'
import { isAllowedFileSignature, safeExternalQualityFileName, validateExternalQualityFile } from '@/lib/external-quality/files'
import { auditRisk, canReviewRisk, getRiskActor, getRiskPermission, type RiskActor } from './access'

// นำตัวตรวจไฟล์ของโมดูล EQA/OUTLAB มาใช้ซ้ำ (ชนิดไฟล์ ขนาด และ magic byte)
// ไม่ใช้ attachment-api.ts ทั้งก้อนเพราะมันผูกกับตาราง eqa/outlab โดยเฉพาะ

const PROBE_BYTES = 'bytes=0-11'

export const attachmentTarget = z.object({
  incidentId: z.number().int().positive().nullish(),
  registerId: z.number().int().positive().nullish(),
  actionId: z.number().int().positive().nullish(),
}).refine(
  value => Boolean(value.incidentId) !== Boolean(value.registerId),
  'ต้องระบุ incidentId หรือ registerId อย่างใดอย่างหนึ่ง',
)

export type AttachmentTarget = z.infer<typeof attachmentTarget>

export function attachmentPrefix(target: AttachmentTarget) {
  return target.incidentId ? `risk/incident/${target.incidentId}/` : `risk/register/${target.registerId}/`
}

export async function requireAttachmentWriter() {
  const actor = await getRiskActor()
  if (!actor) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!canReviewRisk(actor)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { actor }
}

export async function requireAttachmentReader() {
  const actor = await getRiskActor()
  if (!actor) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if ((await getRiskPermission(actor.role)) === 'none') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { actor }
}

export async function presignUpload(body: unknown) {
  const meta = z.object({
    fileName: z.string().min(1),
    contentType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
  }).parse(body)
  const target = attachmentTarget.parse(body)

  const check = validateExternalQualityFile(meta.fileName, meta.contentType, meta.sizeBytes)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 422 })

  const key = `${attachmentPrefix(target)}${crypto.randomUUID()}-${safeExternalQualityFileName(meta.fileName)}`
  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: meta.contentType }),
    { expiresIn: 300 },
  )
  return NextResponse.json({ uploadUrl, key })
}

/**
 * ยืนยันไฟล์ที่อัปโหลดขึ้น R2 แล้วบันทึกลงฐานข้อมูล
 *
 * ตรวจ magic byte จริงหลังอัปโหลด เพราะ content-type ที่ client ส่งมาปลอมได้
 * ถ้าไม่ผ่านจะลบไฟล์ทิ้งจาก R2 ไม่ปล่อยให้ค้าง
 */
export async function finalizeUpload(actor: RiskActor, body: unknown) {
  const parsed = z.object({ key: z.string().min(1), fileName: z.string().min(1) }).parse(body)
  const target = attachmentTarget.parse(body)
  const key = parsed.key

  try {
    if (!key.startsWith(attachmentPrefix(target))) throw new Error('เส้นทางไฟล์ไม่ตรงกับรายการที่ระบุ')

    const head = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    const contentType = head.ContentType ?? ''
    const sizeBytes = Number(head.ContentLength ?? 0)

    const check = validateExternalQualityFile(parsed.fileName, contentType, sizeBytes)
    if (!check.ok) throw new Error(check.error)

    const probe = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: PROBE_BYTES }))
    const bytes = new Uint8Array(await probe.Body!.transformToByteArray())
    if (!isAllowedFileSignature(contentType, bytes)) throw new Error('เนื้อหาไฟล์ไม่ตรงกับประเภทที่ระบุ')

    const { data, error } = await supabaseAdmin
      .from('risk_attachments')
      .insert({
        incident_id: target.incidentId ?? null,
        register_id: target.registerId ?? null,
        action_id: target.actionId ?? null,
        r2_key: key,
        file_name: parsed.fileName,
        content_type: contentType,
        size_bytes: sizeBytes,
        uploaded_by: actor.id,
      })
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    auditRisk('risk.attachment.upload', actor.id, String(data.id), parsed.fileName)
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {})
    return NextResponse.json({ error: (error as Error).message }, { status: 422 })
  }
}

export async function streamAttachment(id: string, range: string | null) {
  const { data } = await supabaseAdmin.from('risk_attachments').select('*').eq('id', id).single()
  if (!data) return NextResponse.json({ error: 'ไม่พบไฟล์นี้' }, { status: 404 })

  try {
    const object = await r2.send(new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: data.r2_key,
      Range: range ?? undefined,
    }))
    return r2ObjectResponse(object, {
      contentType: data.content_type,
      contentDisposition: contentDispositionForExternalQualityAttachment(String(data.file_name).replace(/[\r\n]/g, '_')),
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function removeAttachment(actor: RiskActor, id: string) {
  const { data } = await supabaseAdmin.from('risk_attachments').delete().eq('id', id).select('*').single()
  if (!data) return NextResponse.json({ error: 'ไม่พบไฟล์นี้' }, { status: 404 })

  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: data.r2_key })).catch(() => {})
  auditRisk('risk.attachment.delete', actor.id, id, data.file_name)
  return new NextResponse(null, { status: 204 })
}
