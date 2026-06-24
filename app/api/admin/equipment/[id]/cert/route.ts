import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPermissionsWithEquipmentOverride } from '@/lib/permissions'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

interface Params { params: Promise<{ id: string }> }

// GET → presigned download URL
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
    if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') === 'none')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const { data: eq, error } = await supabaseAdmin
      .from('equipment').select('pm_cal_data').eq('id', id).single()

    if (error || !eq) return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 })
    const fileUrl = (eq.pm_cal_data as { certificate_file_url?: string } | null)?.certificate_file_url
    if (!fileUrl) return NextResponse.json({ error: 'ไม่มีไฟล์ใบ Certificate' }, { status: 404 })

    const url = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: fileUrl }),
      { expiresIn: 3600 }
    )
    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

// POST → generate presigned PUT URL for direct browser-to-R2 upload
// Body: { fileName: string, fileType: string, fileSize: number }
// Returns: { uploadUrl: string, key: string }
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
    if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const { fileName, fileType, fileSize } = await req.json()

    if (!fileName || !fileType) return NextResponse.json({ error: 'ข้อมูลไฟล์ไม่ครบ' }, { status: 422 })
    if (fileSize > 50 * 1024 * 1024) return NextResponse.json({ error: 'ขนาดไฟล์เกิน 50 MB' }, { status: 422 })
    if (!ALLOWED_TYPES.includes(fileType)) return NextResponse.json({ error: 'รองรับเฉพาะ PDF และรูปภาพ (JPG, PNG, WEBP)' }, { status: 422 })

    const safeName = (fileName as string).replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `equipment/${id}/cert/${Date.now()}-${safeName}`

    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: fileType }),
      { expiresIn: 300 }
    )
    return NextResponse.json({ uploadUrl, key })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

// PATCH → called after browser uploads directly to R2; deletes old file and saves new key to DB
// Body: { key: string }
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
    if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const { key } = await req.json()
    if (!key || typeof key !== 'string') return NextResponse.json({ error: 'ไม่พบ key' }, { status: 422 })
    if (!key.startsWith(`equipment/${id}/cert/`)) return NextResponse.json({ error: 'key ไม่ถูกต้อง' }, { status: 422 })

    const { data: eq } = await supabaseAdmin.from('equipment').select('pm_cal_data').eq('id', id).single()
    const oldKey = (eq?.pm_cal_data as { certificate_file_url?: string } | null)?.certificate_file_url
    if (oldKey && oldKey !== key) {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: oldKey })).catch(() => {})
    }

    const updatedData = { ...(eq?.pm_cal_data ?? {}), certificate_file_url: key }
    const { error: updateErr } = await supabaseAdmin
      .from('equipment').update({ pm_cal_data: updatedData }).eq('id', id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, certificate_file_url: key })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

// DELETE → remove from R2 and clear certificate_file_url
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
    if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const { data: eq } = await supabaseAdmin.from('equipment').select('pm_cal_data').eq('id', id).single()
    const oldKey = (eq?.pm_cal_data as { certificate_file_url?: string } | null)?.certificate_file_url
    if (oldKey) {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: oldKey })).catch(() => {})
    }
    const updatedData = { ...(eq?.pm_cal_data ?? {}), certificate_file_url: null }
    await supabaseAdmin.from('equipment').update({ pm_cal_data: updatedData }).eq('id', id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
