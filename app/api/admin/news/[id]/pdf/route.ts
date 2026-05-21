import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: news } = await supabaseAdmin
    .from('news').select('pdf_path').eq('id', id).single()
  if (!news?.pdf_path) return NextResponse.json({ error: 'ไม่มีไฟล์ PDF' }, { status: 404 })

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: news.pdf_path }),
    { expiresIn: 3600 }
  )

  return NextResponse.json({ url })
}
