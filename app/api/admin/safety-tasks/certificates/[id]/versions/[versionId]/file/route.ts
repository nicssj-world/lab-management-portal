import { NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const { id, versionId } = await params
    const { data, error } = await supabaseAdmin.from('safety_certificate_versions').select('r2_key').eq('id', versionId).eq('certificate_id', id).single()
    if (error || !data) throw new Error(error?.message ?? 'Certificate version not found')
    return NextResponse.redirect(await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: data.r2_key }), { expiresIn: 300 }))
  } catch (error) { return safetyTaskError(error) }
}
