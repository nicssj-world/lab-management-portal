import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { r2ObjectResponse } from '@/lib/r2/stream-response'
import { contentDispositionForInline } from '@/lib/documents/download-filename'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'

async function attachment(id: string) {
  const { data, error } = await supabaseAdmin.from('quality_task_attachments').select('*, quality_task_instances!inner(status, quality_task_templates!inner(evidence_required,workstream))').eq('id', id).eq('quality_task_instances.quality_task_templates.workstream', 'quality').single()
  if (error || !data) throw new Error(error?.message ?? 'Attachment not found')
  return data as any
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const row = await attachment((await params).id)
    if (req.nextUrl.searchParams.get('proxy') === '1') {
      const object = await r2.send(new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: row.r2_key,
        Range: req.headers.get('range') ?? undefined,
      }))
      const fileName = String(row.file_name ?? 'quality-task-evidence.pdf').replace(/[\r\n]/g, '_')
      return r2ObjectResponse(object, {
        contentType: row.content_type || 'application/pdf',
        contentDisposition: contentDispositionForInline(fileName),
      })
    }
    const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: row.r2_key }), { expiresIn: 300 })
    return NextResponse.redirect(url)
  } catch (error) { return qualityTaskError(error) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await qualityTaskContext('edit'); if (ctx.response) return ctx.response
  try {
    const id = (await params).id; const row = await attachment(id)
    const instance = row.quality_task_instances; const required = Boolean(instance?.quality_task_templates?.evidence_required)
    if (required && instance?.status === 'completed') {
      const { count } = await supabaseAdmin.from('quality_task_attachments').select('*', { count: 'exact', head: true }).eq('instance_id', row.instance_id)
      if ((count ?? 0) <= 1) throw new Error('ไม่สามารถลบ PDF หลักฐานสุดท้ายของงานที่ปิดแล้ว')
    }
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: row.r2_key }))
    const { error } = await supabaseAdmin.from('quality_task_attachments').delete().eq('id', id); if (error) throw error
    supabaseAdmin.from('audit_log').insert({ action: 'quality_task.attachment.delete', user_id: ctx.actor.id, target: row.instance_id, detail: row.file_name }).then(undefined, () => {})
    return NextResponse.json({ ok: true })
  } catch (error) { return qualityTaskError(error) }
}
