import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

type DocType = 'method_validation' | 'method_correlation' | 'manual'

const DOC_COLUMN: Record<DocType, string> = {
  method_validation:  'method_validation_url',
  method_correlation: 'method_correlation_url',
  manual:             'manual_url',
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/webp',
]
const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

interface Params { params: Promise<{ id: string }> }

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

function isValidDocType(t: unknown): t is DocType {
  return t === 'method_validation' || t === 'method_correlation' || t === 'manual'
}

// GET ?doc_type=... → presigned download URL
export async function GET(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') === 'none')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const docType = req.nextUrl.searchParams.get('doc_type')
  if (!isValidDocType(docType)) return NextResponse.json({ error: 'doc_type ไม่ถูกต้อง' }, { status: 422 })

  const col = DOC_COLUMN[docType]
  const { data: eq } = await supabaseAdmin.from('equipment').select(col).eq('id', id).single()
  const key = eq?.[col as keyof typeof eq] as string | null
  if (!key) return NextResponse.json({ error: 'ไม่มีไฟล์' }, { status: 404 })

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn: 3600 }
  )
  return NextResponse.json({ url })
}

// POST { doc_type, fileName, fileType, fileSize } → { uploadUrl, key }
export async function POST(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { doc_type, fileName, fileType, fileSize } = await req.json()
  if (!isValidDocType(doc_type)) return NextResponse.json({ error: 'doc_type ไม่ถูกต้อง' }, { status: 422 })
  if (!fileName || !fileType) return NextResponse.json({ error: 'ข้อมูลไฟล์ไม่ครบ' }, { status: 422 })
  if (fileSize > MAX_SIZE) return NextResponse.json({ error: 'ขนาดไฟล์เกิน 50 MB' }, { status: 422 })
  if (!ALLOWED_TYPES.includes(fileType)) return NextResponse.json({ error: 'ประเภทไฟล์ไม่รองรับ' }, { status: 422 })

  const safeName = (fileName as string).replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `equipment/${id}/docs/${doc_type}/${Date.now()}-${safeName}`

  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: fileType }),
    { expiresIn: 300 }
  )
  return NextResponse.json({ uploadUrl, key })
}

// PATCH { doc_type, key } → save key to DB, delete old key if exists
export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { doc_type, key } = await req.json()
  if (!isValidDocType(doc_type) || !key) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 422 })
  if (typeof key !== 'string') return NextResponse.json({ error: 'key ไม่ถูกต้อง' }, { status: 422 })
  if (!key.startsWith(`equipment/${id}/docs/${doc_type}/`)) return NextResponse.json({ error: 'key ไม่ถูกต้อง' }, { status: 422 })

  const col = DOC_COLUMN[doc_type]
  const { data: eq } = await supabaseAdmin.from('equipment').select(col).eq('id', id).single()
  const oldKey = eq?.[col as keyof typeof eq] as string | null
  if (oldKey && oldKey !== key) {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: oldKey })).catch(() => {})
  }

  const { error } = await supabaseAdmin.from('equipment').update({ [col]: key }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ [col]: key })
}

// DELETE ?doc_type=... → remove from R2 + clear DB
export async function DELETE(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const docType = req.nextUrl.searchParams.get('doc_type')
  if (!isValidDocType(docType)) return NextResponse.json({ error: 'doc_type ไม่ถูกต้อง' }, { status: 422 })

  const col = DOC_COLUMN[docType]
  const { data: eq } = await supabaseAdmin.from('equipment').select(col).eq('id', id).single()
  const key = eq?.[col as keyof typeof eq] as string | null
  if (key) {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {})
  }
  await supabaseAdmin.from('equipment').update({ [col]: null }).eq('id', id)
  return new NextResponse(null, { status: 204 })
}
