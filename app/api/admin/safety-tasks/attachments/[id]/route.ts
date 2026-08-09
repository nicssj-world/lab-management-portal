import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { getOccurrenceAccess } from '@/lib/quality-tasks/server'

async function attachment(id: string) {
  const { data, error } = await supabaseAdmin.from('quality_task_attachments').select('*, quality_task_instances!inner(status,quality_task_templates!inner(workstream))').eq('id', id).eq('quality_task_instances.quality_task_templates.workstream', 'safety').single()
  if (error || !data) throw new Error(error?.message ?? 'Attachment not found')
  return data as Record<string, any>
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const row = await attachment((await params).id)
    const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: row.r2_key }), { expiresIn: 300 })
    return NextResponse.redirect(url)
  } catch (error) { return safetyTaskError(error) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const id = (await params).id
    const row = await attachment(id)
    await getOccurrenceAccess(String(row.instance_id), ctx.actor, ctx.level, 'safety')
    const status = String(row.quality_task_instances?.status)
    if (status === 'completed' || status === 'pending_review') throw new Error('ไม่สามารถลบหลักฐานหลังส่งตรวจหรืออนุมัติแล้ว')
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: row.r2_key }))
    const { error } = await supabaseAdmin.from('quality_task_attachments').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) { return safetyTaskError(error) }
}
