import { NextRequest, NextResponse } from 'next/server'
import { externalQualityContext, auditExternalQuality, externalQualityError } from '@/lib/external-quality/access'
import { certificateSchema } from '@/lib/outlab/schemas'
import { certificatePayload } from '@/lib/outlab/api'
import { supabaseAdmin } from '@/lib/supabase/admin'
type Params = { params: Promise<{ id: string }> }
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await externalQualityContext('outlab', true); if (ctx.response) return ctx.response
  try {
    const { id } = await params; const input = certificateSchema.parse(await req.json())
    const { data, error } = await supabaseAdmin.from('outlab_certificates').update(certificatePayload(input, ctx.actor!.id)).eq('id', id).select('*').single()
    if (error) throw error
    await auditExternalQuality('outlab', 'certificate.update', ctx.actor!.id, id, data.standard_name)
    return NextResponse.json(data)
  } catch (error) { return externalQualityError(error) }
}
export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await externalQualityContext('outlab', true); if (ctx.response) return ctx.response
  try {
    const { id } = await params
    const { error } = await supabaseAdmin.from('outlab_certificates').update({ lifecycle: 'revoked', updated_at: new Date().toISOString(), updated_by: ctx.actor!.id }).eq('id', id)
    if (error) throw error
    await auditExternalQuality('outlab', 'certificate.revoke', ctx.actor!.id, id)
    return new NextResponse(null, { status: 204 })
  } catch (error) { return externalQualityError(error) }
}

