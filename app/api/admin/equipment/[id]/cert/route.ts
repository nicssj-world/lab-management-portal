import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const { data: eq, error } = await supabaseAdmin
      .from('equipment')
      .select('pm_cal_data')
      .eq('id', id)
      .single()

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

// POST multipart/form-data → upload file to R2 server-side, save key
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const perms = await getRolePermissions(actor.role)
    if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 422 })

    if (file.size > 50 * 1024 * 1024)
      return NextResponse.json({ error: 'ขนาดไฟล์เกิน 50 MB' }, { status: 422 })

    const mimeType = file.type || 'application/octet-stream'
    if (!ALLOWED_TYPES.includes(mimeType))
      return NextResponse.json({ error: 'รองรับเฉพาะ PDF และรูปภาพ (JPG, PNG, WEBP)' }, { status: 422 })

    // Delete old cert file if exists
    const { data: eq } = await supabaseAdmin.from('equipment').select('pm_cal_data').eq('id', id).single()
    const oldKey = (eq?.pm_cal_data as { certificate_file_url?: string } | null)?.certificate_file_url
    if (oldKey) {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: oldKey })).catch(() => {})
    }

    // Upload to R2 server-side
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `equipment/${id}/cert/${Date.now()}-${safeName}`
    const buffer = Buffer.from(await file.arrayBuffer())

    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ContentLength: buffer.length,
    }))

    // Save key to pm_cal_data
    const updatedData = { ...(eq?.pm_cal_data ?? {}), certificate_file_url: key }
    const { error: updateErr } = await supabaseAdmin
      .from('equipment')
      .update({ pm_cal_data: updatedData })
      .eq('id', id)

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
    const perms = await getRolePermissions(actor.role)
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
