import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 422 })

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: path }),
    { expiresIn: 3600 }
  )

  const { data: docRow } = await supabaseAdmin
    .from('documents').select('id').eq('file_url', path).maybeSingle()

  supabaseAdmin.from('document_access_logs')
    .insert({ document_id: docRow?.id ?? null, user_id: user.id, action: 'download' })
    .then(undefined, () => {})

  return NextResponse.json({ url })
}
