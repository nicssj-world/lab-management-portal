import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: news } = await supabaseAdmin
    .from('news')
    .select('pdf_path, published')
    .eq('id', id)
    .single()

  if (!news?.published || !news.pdf_path) {
    return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 })
  }

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: news.pdf_path }),
    { expiresIn: 300 }
  )

  return NextResponse.redirect(url)
}
