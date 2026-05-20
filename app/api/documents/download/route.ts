import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'

// Public download endpoint — only serves documents with visibility='Public'
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 422 })

  // Verify document is public before serving
  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('id, visibility')
    .eq('file_url', path)
    .maybeSingle()

  if (!doc || doc.visibility !== 'Public') {
    return NextResponse.json({ error: 'Not found or not public' }, { status: 404 })
  }

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: path }),
    { expiresIn: 3600 }
  )

  supabaseAdmin.from('document_access_logs')
    .insert({ document_id: doc.id, user_id: null, action: 'download' })
    .then(undefined, () => {})

  return NextResponse.json({ url })
}
