import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('test_documents').select('*').eq('test_id', Number(id)).order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['Admin', 'Manager'].includes(actor.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const testId = Number(id)

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const docType = (formData.get('doc_type') as string) || 'Other'

    if (!file) return NextResponse.json({ error: 'ไม่มีไฟล์' }, { status: 422 })

    const ext = file.name.split('.').pop() ?? ''
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const r2Key = `test-documents/${testId}/${Date.now()}-${safeName}`

    const buffer = Buffer.from(await file.arrayBuffer())
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: buffer,
      ContentType: file.type,
    }))

    const docName = file.name.replace(`.${ext}`, '')
    const { data: doc, error: dbErr } = await supabaseAdmin
      .from('test_documents')
      .insert({ test_id: testId, doc_type: docType, name: docName, storage_path: r2Key, uploaded_by: actor.id })
      .select().single()

    if (dbErr) {
      r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: r2Key })).catch(() => {})
      throw new Error(dbErr.message)
    }

    return NextResponse.json(doc, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
