import { NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const { data: certificate, error } = await supabaseAdmin.from('safety_certificates').select('current_version_id').eq('id', (await params).id).eq('active', true).single()
    if (error || !certificate?.current_version_id) throw new Error(error?.message ?? 'Certificate file not found')
    const { data: version, error: versionError } = await supabaseAdmin.from('safety_certificate_versions').select('r2_key').eq('id', certificate.current_version_id).single()
    if (versionError || !version) throw new Error(versionError?.message ?? 'Certificate file not found')
    return NextResponse.redirect(await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: version.r2_key }), { expiresIn: 300 }))
  } catch (error) { return safetyTaskError(error) }
}
