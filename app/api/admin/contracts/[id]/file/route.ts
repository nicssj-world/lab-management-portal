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

interface Params { params: Promise<{ id: string }> }

// GET — generate presigned download URL
export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('contracts').select('file_url').eq('id', Number(id)).single()

  if (error || !data?.file_url)
    return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 })

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: data.file_url }),
    { expiresIn: 3600 }
  )
  return NextResponse.json({ url })
}

// POST — upload file, save key to contracts.file_url
export async function POST(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['สัญญา'] ?? 'none') !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 422 })

  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type))
    return NextResponse.json({ error: 'รองรับเฉพาะ PDF และรูปภาพ' }, { status: 422 })
  if (file.size > 50 * 1024 * 1024)
    return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 50 MB' }, { status: 422 })

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `contracts/${id}/${Date.now()}-${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: file.type,
  }))

  const { data, error } = await supabaseAdmin
    .from('contracts')
    .update({ file_url: key })
    .eq('id', Number(id))
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — remove from R2 and clear file_url
export async function DELETE(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['สัญญา'] ?? 'none') !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { data } = await supabaseAdmin.from('contracts').select('file_url').eq('id', Number(id)).single()

  if (data?.file_url) {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: data.file_url })).catch(() => {})
  }

  await supabaseAdmin.from('contracts').update({ file_url: null }).eq('id', Number(id))
  return new NextResponse(null, { status: 204 })
}
