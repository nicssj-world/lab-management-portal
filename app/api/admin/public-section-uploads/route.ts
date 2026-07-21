import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { canManagePublicSections, getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 50 * 1024 * 1024

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!canManagePublicSections(actor)) return jsonForbidden()

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'ไม่มีไฟล์' }, { status: 422 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'ขนาดไฟล์เกิน 50 MB' }, { status: 422 })

    const displayName = (formData.get('name') as string | null)?.trim()
      || file.name.replace(/\.[^.]+$/, '')
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileKey = `public-sections/${randomUUID()}-${safeName}`

    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: fileKey,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type || 'application/octet-stream',
    }))

    const { data, error } = await supabaseAdmin
      .from('public_section_uploads')
      .insert({
        name: displayName,
        file_key: fileKey,
        file_name: file.name,
        mime_type: file.type || null,
        file_size: file.size,
        uploaded_by: actor.id,
      })
      .select('*')
      .single()

    if (error) {
      r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: fileKey })).catch(() => {})
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    supabaseAdmin.from('audit_log').insert({
      action: 'public_section_upload', user_id: actor.id, target: data.id,
      detail: `อัปโหลดไฟล์ประกอบหน้าเอกสารที่เกี่ยวข้อง: ${data.file_name}`,
    }).then(undefined, () => {})

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }
}
