import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { r2ObjectResponse } from '@/lib/r2/stream-response'
import { externalQualityContext, auditExternalQuality, externalQualityError, type ExternalQualityModule } from './access'
import { isAllowedFileSignature, safeExternalQualityFileName, validateExternalQualityFile } from './files'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { bangkokToday } from './server'
import { contentDispositionForExternalQualityAttachment } from './content-disposition'

const outlabTarget = z.object({ certificateId: z.string().uuid() })
const eqaTarget = z.object({
  roundId: z.string().uuid().nullable().optional().default(null),
  capaId: z.string().uuid().nullable().optional().default(null),
  attachmentKind: z.enum(['provider_report', 'raw_result', 'capa_evidence', 'other']),
}).superRefine((value, ctx) => {
  if (Boolean(value.roundId) === Boolean(value.capaId)) ctx.addIssue({ code: 'custom', message: 'ต้องระบุ roundId หรือ capaId อย่างใดอย่างหนึ่ง' })
})
const metadata = z.object({ fileName: z.string().min(1), contentType: z.string().min(1), sizeBytes: z.number().int().positive() })

function targetFor(module: ExternalQualityModule, body: unknown) {
  return module === 'outlab' ? outlabTarget.parse(body) : eqaTarget.parse(body)
}

function parentId(module: ExternalQualityModule, target: any) {
  return module === 'outlab' ? target.certificateId : (target.roundId ?? target.capaId)
}

export async function presignExternalQualityAttachment(module: ExternalQualityModule, req: NextRequest) {
  const ctx = await externalQualityContext(module, true); if (ctx.response) return ctx.response
  try {
    const body = await req.json()
    const file = metadata.parse(body)
    const target = targetFor(module, body)
    const check = validateExternalQualityFile(file.fileName, file.contentType, file.sizeBytes)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 422 })
    const key = `${module}/${parentId(module, target)}/${crypto.randomUUID()}-${safeExternalQualityFileName(file.fileName)}`
    const uploadUrl = await getSignedUrl(r2, new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: file.contentType }), { expiresIn: 300 })
    return NextResponse.json({ uploadUrl, key })
  } catch (error) { return externalQualityError(error) }
}

export async function finalizeExternalQualityAttachment(module: ExternalQualityModule, req: NextRequest) {
  const ctx = await externalQualityContext(module, true); if (ctx.response) return ctx.response
  let key = ''
  try {
    const body = await req.json()
    key = z.string().min(1).parse(body.key)
    const fileName = z.string().min(1).parse(body.fileName)
    const target = targetFor(module, body)
    const parent = parentId(module, target)
    if (!key.startsWith(`${module}/${parent}/`)) throw new Error('Invalid attachment key')
    const head = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    const contentType = head.ContentType ?? ''
    const sizeBytes = Number(head.ContentLength ?? 0)
    const check = validateExternalQualityFile(fileName, contentType, sizeBytes)
    if (!check.ok) throw new Error(check.error)
    const probe = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: 'bytes=0-11' }))
    const bytes = new Uint8Array(await probe.Body!.transformToByteArray())
    if (!isAllowedFileSignature(contentType, bytes)) throw new Error('เนื้อหาไฟล์ไม่ตรงกับประเภทที่ระบุ')
    const payload = module === 'outlab'
      ? { certificate_id: (target as any).certificateId, r2_key: key, file_name: fileName, content_type: contentType, size_bytes: sizeBytes, uploaded_by: ctx.actor!.id }
      : { round_id: (target as any).roundId, capa_id: (target as any).capaId, attachment_kind: (target as any).attachmentKind, r2_key: key, file_name: fileName, content_type: contentType, size_bytes: sizeBytes, uploaded_by: ctx.actor!.id }
    const table = module === 'outlab' ? 'outlab_certificate_files' : 'eqa_attachments'
    const { data, error } = await (supabaseAdmin.from(table) as any).insert(payload).select('*').single()
    if (error) throw error
    if (module === 'eqa' && (target as any).roundId && (target as any).attachmentKind === 'provider_report') {
      await supabaseAdmin.from('eqa_rounds').update({ report_received_on: bangkokToday(), updated_at: new Date().toISOString(), updated_by: ctx.actor!.id }).eq('id', (target as any).roundId).is('report_received_on', null)
    }
    await auditExternalQuality(module, 'attachment.upload', ctx.actor!.id, String(data.id), fileName)
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (key) await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {})
    return externalQualityError(error)
  }
}

export async function getExternalQualityAttachment(module: ExternalQualityModule, req: NextRequest, id: string) {
  const ctx = await externalQualityContext(module); if (ctx.response) return ctx.response
  const table = module === 'outlab' ? 'outlab_certificate_files' : 'eqa_attachments'
  const { data, error } = await supabaseAdmin.from(table).select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  try {
    const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: data.r2_key, Range: req.headers.get('range') ?? undefined }))
    const safeName = String(data.file_name).replace(/[\r\n]/g, '_')
    return r2ObjectResponse(object, { contentType: data.content_type, contentDisposition: contentDispositionForExternalQualityAttachment(safeName) })
  } catch (error) { return externalQualityError(error) }
}

export async function deleteExternalQualityAttachment(module: ExternalQualityModule, id: string) {
  const ctx = await externalQualityContext(module, true); if (ctx.response) return ctx.response
  const table = module === 'outlab' ? 'outlab_certificate_files' : 'eqa_attachments'
  const { data, error } = await supabaseAdmin.from(table).delete().eq('id', id).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: data.r2_key })).catch(() => {})
  await auditExternalQuality(module, 'attachment.delete', ctx.actor!.id, id, data.file_name)
  return new NextResponse(null, { status: 204 })
}
