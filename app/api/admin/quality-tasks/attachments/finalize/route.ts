import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { z } from 'zod'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { getOccurrenceAccess } from '@/lib/quality-tasks/server'
import { isPdfSignature, validatePdfMetadata } from '@/lib/quality-tasks/validation'

const schema = z.object({ instanceId: z.string().uuid(), key: z.string().min(1), fileName: z.string().min(1), sizeBytes: z.number().int().positive() })

export async function POST(req: NextRequest) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  let key = ''
  try {
    const input = schema.parse(await req.json()); key = input.key
    await getOccurrenceAccess(input.instanceId, ctx.actor, ctx.level)
    if (!key.startsWith(`quality-tasks/${input.instanceId}/`)) throw new Error('Invalid attachment key')
    const head = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    const size = Number(head.ContentLength ?? 0)
    const check = validatePdfMetadata(input.fileName, head.ContentType ?? '', size); if (!check.ok) throw new Error(check.error)
    const probe = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: 'bytes=0-4' }))
    const bytes = new Uint8Array(await probe.Body!.transformToByteArray())
    if (!isPdfSignature(bytes)) throw new Error('เนื้อหาไฟล์ไม่ใช่ PDF')
    const { data, error } = await supabaseAdmin.from('quality_task_attachments').insert({ instance_id: input.instanceId, r2_key: key, file_name: input.fileName, content_type: 'application/pdf', size_bytes: size, uploaded_by: ctx.actor.id }).select('*').single()
    if (error) throw error
    supabaseAdmin.from('audit_log').insert({ action: 'quality_task.attachment.upload', user_id: ctx.actor.id, target: input.instanceId, detail: input.fileName }).then(undefined, () => {})
    return NextResponse.json({ attachment: data }, { status: 201 })
  } catch (error) {
    if (key) await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {})
    return qualityTaskError(error)
  }
}
