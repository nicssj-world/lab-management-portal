import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { contentDispositionForExternalQualityAttachment } from '@/lib/external-quality/content-disposition'
import { isAllowedFileSignature, safeExternalQualityFileName, validateExternalQualityFile } from '@/lib/external-quality/files'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { r2ObjectResponse } from '@/lib/r2/stream-response'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditIt, type ItActor } from './guard'

const PROBE_BYTES = 'bytes=0-11'
const attachmentTarget = z.object({ logId: z.string().uuid() })
const attachmentMetadata = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
})

function attachmentPrefix(logId: string) {
  return `it-backup/${logId}/`
}

async function ensureBackupLog(logId: string) {
  const { data, error } = await supabaseAdmin
    .from('it_backup_logs')
    .select('id')
    .eq('id', logId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('ไม่พบบันทึกการสำรองข้อมูล')
}

export async function presignBackupAttachment(body: unknown) {
  const target = attachmentTarget.parse(body)
  const file = attachmentMetadata.parse(body)
  await ensureBackupLog(target.logId)

  const check = validateExternalQualityFile(file.fileName, file.contentType, file.sizeBytes)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 422 })

  const key = `${attachmentPrefix(target.logId)}${crypto.randomUUID()}-${safeExternalQualityFileName(file.fileName)}`
  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: file.contentType }),
    { expiresIn: 300 },
  )
  return NextResponse.json({ uploadUrl, key })
}

/**
 * ตรวจไฟล์จริงหลังอัปโหลดขึ้น R2 แล้วจึงบันทึก metadata ลงฐานข้อมูล
 * เพื่อไม่ให้ content-type ที่ส่งมาจาก browser เพียงอย่างเดียวเป็นตัวตัดสินชนิดไฟล์
 */
export async function finalizeBackupAttachment(actor: ItActor, body: unknown) {
  const parsed = z.object({
    logId: z.string().uuid(),
    key: z.string().min(1),
    fileName: z.string().min(1).max(255),
  }).parse(body)
  const key = parsed.key

  try {
    await ensureBackupLog(parsed.logId)
    if (!key.startsWith(attachmentPrefix(parsed.logId))) throw new Error('เส้นทางไฟล์ไม่ตรงกับบันทึกที่ระบุ')

    const head = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    const contentType = head.ContentType ?? ''
    const sizeBytes = Number(head.ContentLength ?? 0)
    const check = validateExternalQualityFile(parsed.fileName, contentType, sizeBytes)
    if (!check.ok) throw new Error(check.error)

    const probe = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: PROBE_BYTES }))
    const bytes = new Uint8Array(await probe.Body!.transformToByteArray())
    if (!isAllowedFileSignature(contentType, bytes)) throw new Error('เนื้อหาไฟล์ไม่ตรงกับประเภทที่ระบุ')

    const { data, error } = await supabaseAdmin
      .from('it_backup_attachments')
      .insert({
        backup_log_id: parsed.logId,
        r2_key: key,
        file_name: parsed.fileName,
        content_type: contentType,
        size_bytes: sizeBytes,
        uploaded_by: actor.id,
      })
      .select('id, backup_log_id, file_name, content_type, size_bytes, uploaded_by, uploaded_at')
      .single()
    if (error) throw new Error(error.message)

    auditIt('it_backup.attachment.upload', actor.id, String(data.id), parsed.fileName)
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {})
    throw error
  }
}

export async function streamBackupAttachment(id: string, range: string | null) {
  const { data, error } = await supabaseAdmin
    .from('it_backup_attachments')
    .select('id, r2_key, file_name, content_type')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'ไม่พบไฟล์หลักฐาน' }, { status: 404 })

  try {
    const object = await r2.send(new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: data.r2_key,
      Range: range ?? undefined,
    }))
    const safeName = String(data.file_name).replace(/[\r\n]/g, '_')
    return r2ObjectResponse(object, {
      contentType: data.content_type,
      contentDisposition: contentDispositionForExternalQualityAttachment(safeName),
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function removeBackupAttachment(actor: ItActor, id: string) {
  const { data, error } = await supabaseAdmin
    .from('it_backup_attachments')
    .delete()
    .eq('id', id)
    .select('id, r2_key, file_name')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'ไม่พบไฟล์หลักฐาน' }, { status: 404 })

  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: data.r2_key })).catch(() => {})
  auditIt('it_backup.attachment.delete', actor.id, id, data.file_name)
  return new NextResponse(null, { status: 204 })
}

/** ล้าง metadata และไฟล์ใน R2 เมื่อผู้ใช้ลบบันทึกหลัก */
export async function removeBackupAttachmentsForLog(logId: string) {
  const { data, error } = await supabaseAdmin
    .from('it_backup_attachments')
    .select('r2_key')
    .eq('backup_log_id', logId)
  if (error || !data) return

  await Promise.all(data.map((attachment) =>
    r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: attachment.r2_key })).catch(() => {}),
  ))
}
