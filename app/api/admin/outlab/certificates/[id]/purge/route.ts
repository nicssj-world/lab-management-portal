import { NextResponse } from 'next/server'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { externalQualityContext, auditExternalQuality, externalQualityError } from '@/lib/external-quality/access'
import { supabaseAdmin } from '@/lib/supabase/admin'
type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await externalQualityContext('outlab', true); if (ctx.response) return ctx.response
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const { id } = await params
    const { data: cert, error: certError } = await supabaseAdmin.from('outlab_certificates').select('standard_name').eq('id', id).single()
    if (certError || !cert) return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    const { count } = await supabaseAdmin.from('outlab_certificates').select('id', { count: 'exact', head: true }).eq('supersedes_id', id)
    if (count) return NextResponse.json({ error: 'ไม่สามารถลบได้เนื่องจากมีใบรับรองอื่นต่ออายุจากใบนี้' }, { status: 409 })
    const { data: files } = await supabaseAdmin.from('outlab_certificate_files').select('r2_key').eq('certificate_id', id)
    for (const file of files ?? []) {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: file.r2_key })).catch(() => {})
    }
    const { error } = await supabaseAdmin.from('outlab_certificates').delete().eq('id', id)
    if (error) throw error
    await auditExternalQuality('outlab', 'certificate.purge', ctx.actor!.id, id, cert.standard_name)
    return new NextResponse(null, { status: 204 })
  } catch (error) { return externalQualityError(error) }
}
