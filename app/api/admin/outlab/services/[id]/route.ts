import { NextRequest, NextResponse } from 'next/server'
import { externalQualityContext, auditExternalQuality, externalQualityError } from '@/lib/external-quality/access'
import { serviceSchema } from '@/lib/outlab/schemas'
import { assertOutlabCatalogTest, servicePayload } from '@/lib/outlab/api'
import { supabaseAdmin } from '@/lib/supabase/admin'
type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await externalQualityContext('outlab', true); if (ctx.response) return ctx.response
  try {
    const { id } = await params; const input = serviceSchema.parse(await req.json())
    await assertOutlabCatalogTest(input.testId)
    const { data, error } = await supabaseAdmin.from('outlab_services').update(servicePayload(input, ctx.actor!.id)).eq('id', id).select('*').single()
    if (error) throw error
    await auditExternalQuality('outlab', 'service.update', ctx.actor!.id, id, data.test_name_snapshot)
    return NextResponse.json(data)
  } catch (error) { return externalQualityError(error) }
}
export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await externalQualityContext('outlab', true); if (ctx.response) return ctx.response
  try {
    const { id } = await params
    const { error } = await supabaseAdmin.from('outlab_services').update({ active: false, is_primary: false, updated_at: new Date().toISOString(), updated_by: ctx.actor!.id }).eq('id', id)
    if (error) throw error
    await auditExternalQuality('outlab', 'service.deactivate', ctx.actor!.id, id)
    return new NextResponse(null, { status: 204 })
  } catch (error) { return externalQualityError(error) }
}
