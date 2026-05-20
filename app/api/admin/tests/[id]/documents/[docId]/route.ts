import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

type Params = { params: Promise<{ id: string; docId: string }> }

// Presigned download URL
export async function GET(_req: NextRequest, { params }: Params) {
  const { docId } = await params
  const { data: doc, error } = await supabaseAdmin
    .from('test_documents').select('storage_path').eq('id', Number(docId)).single()
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
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['Admin', 'Manager'].includes(actor.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { docId } = await params
    const { data: doc } = await supabaseAdmin
      .from('test_documents').select('storage_path').eq('id', Number(docId)).single()

    if (doc?.storage_path) {
      r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: doc.storage_path })).catch(() => {})
    }

    const { error } = await supabaseAdmin.from('test_documents').delete().eq('id', Number(docId))
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
