import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { canManagePublicSections, getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!canManagePublicSections(actor)) return jsonForbidden()

  const { id } = await params
  const { data: upload } = await supabaseAdmin
    .from('public_section_uploads')
    .select('id, file_key, file_name')
    .eq('id', id)
    .maybeSingle()
  if (!upload) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 })

  // Section membership rows cascade from this delete.
  const { error } = await supabaseAdmin.from('public_section_uploads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: upload.file_key })).catch(() => {})

  supabaseAdmin.from('audit_log').insert({
    action: 'public_section_upload_delete', user_id: actor.id, target: id,
    detail: `ลบไฟล์ประกอบหน้าเอกสารที่เกี่ยวข้อง: ${upload.file_name}`,
  }).then(undefined, () => {})

  return NextResponse.json({ ok: true })
}
