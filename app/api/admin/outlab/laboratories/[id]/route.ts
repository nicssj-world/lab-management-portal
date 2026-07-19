import { NextRequest, NextResponse } from 'next/server'
import { externalQualityContext, auditExternalQuality, externalQualityError } from '@/lib/external-quality/access'
import { laboratorySchema } from '@/lib/outlab/schemas'
import { laboratoryPayload, syncLaboratoryOwners } from '@/lib/outlab/api'
import { supabaseAdmin } from '@/lib/supabase/admin'
type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await externalQualityContext('outlab', true); if (ctx.response) return ctx.response
  try {
    const { id } = await params; const input = laboratorySchema.parse(await req.json())
    const { data, error } = await supabaseAdmin.from('outlab_laboratories').update(laboratoryPayload(input, ctx.actor!.id)).eq('id', id).select('*').single()
    if (error) throw error
    await syncLaboratoryOwners(id, input)
    await auditExternalQuality('outlab', 'laboratory.update', ctx.actor!.id, id, data.name)
    return NextResponse.json(data)
  } catch (error) { return externalQualityError(error) }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await externalQualityContext('outlab', true); if (ctx.response) return ctx.response
  try {
    const { id } = await params
    const { data, error } = await supabaseAdmin.from('outlab_laboratories').update({ active: false, publish_public: false, updated_at: new Date().toISOString(), updated_by: ctx.actor!.id }).eq('id', id).select('id,name').single()
    if (error) throw error
    await auditExternalQuality('outlab', 'laboratory.deactivate', ctx.actor!.id, id, data.name)
    return new NextResponse(null, { status: 204 })
  } catch (error) { return externalQualityError(error) }
}

