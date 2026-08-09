import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { z } from 'zod'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { isAllowedFileSignature } from '@/lib/external-quality/files'
import { validateSafetyEvidenceMetadata } from '@/lib/quality-tasks/safety'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { getOccurrenceAccess } from '@/lib/quality-tasks/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const schema = z.object({ instanceId: z.string().uuid(), key: z.string().min(1), fileName: z.string().min(1).max(255), requirementId: z.string().uuid().nullable(), evidenceKind: z.string().trim().min(1).max(60).default('document') })

export async function POST(req: NextRequest) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  let key = ''
  try {
    const input = schema.parse(await req.json()); key = input.key
    const access = await getOccurrenceAccess(input.instanceId, ctx.actor, ctx.level, 'safety')
    if (!key.startsWith(`safety-tasks/${input.instanceId}/`)) throw new Error('Invalid attachment key')
    if (input.requirementId) {
      const { data: requirement, error } = await supabaseAdmin.from('quality_task_evidence_requirements').select('id,evidence_kind').eq('id', input.requirementId).eq('template_id', access.instance.template_id).eq('active', true).maybeSingle()
      if (error) throw error
      if (!requirement) throw new Error('Evidence requirement not found')
    }
    const head = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    const contentType = head.ContentType ?? ''
    const sizeBytes = Number(head.ContentLength ?? 0)
    const check = validateSafetyEvidenceMetadata(input.fileName, contentType, sizeBytes)
    if (!check.ok) throw new Error(check.error)
    const probe = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: 'bytes=0-11' }))
    const bytes = new Uint8Array(await probe.Body!.transformToByteArray())
    if (!isAllowedFileSignature(contentType, bytes)) throw new Error('เนื้อหาไฟล์ไม่ตรงกับประเภทที่ระบุ')
    const { data, error } = await supabaseAdmin.from('quality_task_attachments').insert({
      instance_id: input.instanceId, requirement_id: input.requirementId, evidence_kind: input.evidenceKind,
      r2_key: key, file_name: input.fileName, content_type: contentType, size_bytes: sizeBytes, uploaded_by: ctx.actor.id,
    }).select('*').single()
    if (error) throw error
    return NextResponse.json({ attachment: data }, { status: 201 })
  } catch (error) {
    if (key) await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {})
    return safetyTaskError(error)
  }
}
