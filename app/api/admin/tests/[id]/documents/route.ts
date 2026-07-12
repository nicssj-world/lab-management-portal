import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { canEditTests } from '@/lib/tests/permissions'
import { getActor, getPermissionLevel, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { normalizeDocumentAccess } from '@/lib/tests/document-access'

type Params = { params: Promise<{ id: string }> }
const MAX_FILE_SIZE = 50 * 1024 * 1024

export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if ((await getPermissionLevel(actor, 'รายการตรวจ')) === 'none') return jsonForbidden()

  const { id } = await params
  const testId = Number(id)
  if (!Number.isInteger(testId) || testId <= 0) return NextResponse.json({ error: 'Invalid test id' }, { status: 422 })

  const { data, error } = await supabaseAdmin
    .from('test_documents').select('*').eq('test_id', testId).order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await getActor()
    if (!actor) return jsonUnauthorized()
    const permissionLevel = await getPermissionLevel(actor, 'รายการตรวจ')
    if (!canEditTests(actor, permissionLevel)) return jsonForbidden()

    const { id } = await params
    const testId = Number(id)
    if (!Number.isInteger(testId) || testId <= 0) return NextResponse.json({ error: 'Invalid test id' }, { status: 422 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const docType = (formData.get('doc_type') as string) || 'Other'
    const access = normalizeDocumentAccess(
      formData.get('visibility') as string | null,
      formData.get('access_mode') as string | null,
    )

    if (!file) return NextResponse.json({ error: 'ไม่มีไฟล์' }, { status: 422 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'ขนาดไฟล์เกิน 50 MB' }, { status: 422 })

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
      .insert({ test_id: testId, doc_type: docType, name: docName, storage_path: r2Key, uploaded_by: actor.id, visibility: access.visibility, access_mode: access.accessMode })
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
