import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { canEditTests } from '@/lib/tests/permissions'
import { getActor, getPermissionLevel, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'

type Params = { params: Promise<{ id: string; docId: string }> }

// Presigned download URL
export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if ((await getPermissionLevel(actor, 'รายการตรวจ')) === 'none') return jsonForbidden()

  const { id, docId } = await params
  const testId = Number(id)
  const documentId = Number(docId)
  if (!Number.isInteger(testId) || !Number.isInteger(documentId)) return NextResponse.json({ error: 'Invalid id' }, { status: 422 })

  const { data: doc, error } = await supabaseAdmin
    .from('test_documents').select('storage_path').eq('id', documentId).eq('test_id', testId).single()
  if (error || !doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: doc.storage_path }),
    { expiresIn: 3600 }
  )

  return NextResponse.json({ url })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const actor = await getActor()
    if (!actor) return jsonUnauthorized()
    const permissionLevel = await getPermissionLevel(actor, 'รายการตรวจ')
    if (!canEditTests(actor, permissionLevel)) return jsonForbidden()

    const { id, docId } = await params
    const testId = Number(id)
    const documentId = Number(docId)
    if (!Number.isInteger(testId) || !Number.isInteger(documentId)) return NextResponse.json({ error: 'Invalid id' }, { status: 422 })

    const { data: doc } = await supabaseAdmin
      .from('test_documents').select('storage_path').eq('id', documentId).eq('test_id', testId).single()
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (doc?.storage_path) {
      r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: doc.storage_path })).catch(() => {})
    }

    const { error } = await supabaseAdmin.from('test_documents').delete().eq('id', documentId).eq('test_id', testId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
