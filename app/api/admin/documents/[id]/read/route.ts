import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role, name').eq('id', user.id).single()
  return data as { id: string; role: string; name: string } | null
}

// POST — log read event + return presigned URL
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: doc, error: docErr } = await supabaseAdmin
    .from('documents')
    .select('id, file_url, mime_type, title, document_code')
    .eq('id', id)
    .single()

  if (docErr || !doc) return NextResponse.json({ error: 'ไม่พบเอกสาร' }, { status: 404 })

  // Generate R2 presigned URL (1 hour)
  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: doc.file_url }),
    { expiresIn: 3600 }
  )

  // Log the view — skip Admin role (fire-and-forget)
  if (actor.role !== 'Admin') {
    supabaseAdmin.from('document_access_logs')
      .insert({ document_id: id, user_id: actor.id, action: 'view' })
      .then(undefined, () => {})
  }

  return NextResponse.json({ url, mime_type: doc.mime_type })
}

// GET — list who has read this document (Admin/Manager only)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['Admin', 'Manager'].includes(actor.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('document_access_logs')
    .select('id, user_id, action, created_at, profiles(name, role)')
    .eq('document_id', id)
    .eq('action', 'view')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
