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

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
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
    const { data: eq, error } = await supabaseAdmin.from('equipment').select('photo_url').eq('id', id).single()
    if (error || !eq) return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 })
    if (!eq.photo_url) return NextResponse.json({ error: 'ไม่มีรูปถ่าย' }, { status: 404 })

    const url = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: eq.photo_url }),
      { expiresIn: 3600 }
    )
    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

// POST → generate presigned PUT URL for direct browser-to-R2 upload
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
    if (fileSize > 20 * 1024 * 1024) return NextResponse.json({ error: 'ขนาดไฟล์เกิน 20 MB' }, { status: 422 })
    if (!ALLOWED_TYPES.includes(fileType)) return NextResponse.json({ error: 'รองรับเฉพาะรูปภาพ (JPG, PNG, WEBP, HEIC, GIF)' }, { status: 422 })

    const safeName = (fileName as string).replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `equipment/${id}/photo/${Date.now()}-${safeName}`

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

// PATCH → save key to DB after browser uploads directly to R2
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
    if (!key.startsWith(`equipment/${id}/photo/`)) return NextResponse.json({ error: 'key ไม่ถูกต้อง' }, { status: 422 })

    const { data: eq } = await supabaseAdmin.from('equipment').select('photo_url').eq('id', id).single()
    const oldKey = eq?.photo_url
    if (oldKey && oldKey !== key) {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: oldKey })).catch(() => {})
    }

    const { error } = await supabaseAdmin.from('equipment').update({ photo_url: key }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ photo_url: key })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

// DELETE → remove from R2 and clear photo_url
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
    if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const { data: eq } = await supabaseAdmin.from('equipment').select('photo_url').eq('id', id).single()
    if (eq?.photo_url) {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: eq.photo_url })).catch(() => {})
    }
    await supabaseAdmin.from('equipment').update({ photo_url: null }).eq('id', id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
