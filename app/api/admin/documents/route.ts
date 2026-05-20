import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { DocumentSchema } from '@/lib/validations/document'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

function toMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const type       = sp.get('type') ?? undefined
    const visibility = sp.get('visibility') ?? undefined
    const department = sp.get('department') ?? undefined
    const search     = sp.get('search') ?? undefined
    const page       = Number(sp.get('page') ?? 1)
    const pageSize   = Number(sp.get('pageSize') ?? 50)
    const sortBy     = sp.get('sortBy') ?? 'updated_at'
    const sortDir    = (sp.get('sortDir') ?? 'desc') as 'asc' | 'desc'

    let query = supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)

    if (type && type !== 'All') query = query.eq('type', type)
    if (visibility)             query = query.eq('visibility', visibility)
    if (department)             query = query.eq('department', department)
    if (search) {
      query = query.or(`title.ilike.%${search}%,document_code.ilike.%${search}%`)
    }

    const from = (page - 1) * pageSize
    const { data, error, count } = await query
      .order(sortBy, { ascending: sortDir === 'asc' })
      .range(from, from + pageSize - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [], count: count ?? 0 })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const canUpload = ['Admin', 'Manager', 'Medical Technologist'].includes(actor.role)
  if (!canUpload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 422 })

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 50 MB' }, { status: 422 })
    }

    const metaRaw = form.get('meta')
    if (!metaRaw) return NextResponse.json({ error: 'ไม่พบข้อมูลเอกสาร' }, { status: 422 })

    const parsed = DocumentSchema.safeParse(JSON.parse(metaRaw as string))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
    }
    const meta = parsed.data

    const year = new Date().getFullYear()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const r2Key = `documents/${meta.type.toLowerCase()}/${year}/${Date.now()}-${safeName}`

    const buffer = Buffer.from(await file.arrayBuffer())
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: buffer,
      ContentType: file.type,
    }))

    const { data: doc, error: dbErr } = await supabaseAdmin
      .from('documents')
      .insert({
        ...meta,
        owner_id:  actor.id,
        file_url:  r2Key,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single()

    if (dbErr) {
      // Best-effort cleanup on DB error
      r2.send(new (await import('@aws-sdk/client-s3')).DeleteObjectCommand({ Bucket: R2_BUCKET, Key: r2Key }))
        .catch(() => {})
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    supabaseAdmin.from('document_access_logs')
      .insert({ document_id: doc.id, user_id: actor.id, action: 'upload' })
      .then(undefined, () => {})

    return NextResponse.json(doc, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
