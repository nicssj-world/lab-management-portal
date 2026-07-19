import { NextRequest, NextResponse } from 'next/server'
import { externalQualityContext, auditExternalQuality, externalQualityError } from '@/lib/external-quality/access'
import { getOutlabOverview } from '@/lib/outlab/server'
import { laboratorySchema } from '@/lib/outlab/schemas'
import { laboratoryPayload, syncLaboratoryOwners } from '@/lib/outlab/api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const ctx = await externalQualityContext('outlab'); if (ctx.response) return ctx.response
  try { return NextResponse.json({ ...(await getOutlabOverview()), canEdit: ctx.canEdit, isAdmin: ctx.isAdmin }) }
  catch (error) { return externalQualityError(error) }
}

export async function POST(req: NextRequest) {
  const ctx = await externalQualityContext('outlab', true); if (ctx.response) return ctx.response
  try {
    const input = laboratorySchema.parse(await req.json())
    const { data, error } = await supabaseAdmin.from('outlab_laboratories')
      .insert({ ...laboratoryPayload(input, ctx.actor!.id), created_by: ctx.actor!.id }).select('*').single()
    if (error) throw error
    try { await syncLaboratoryOwners(data.id, input) }
    catch (error) { await supabaseAdmin.from('outlab_laboratories').delete().eq('id', data.id); throw error }
    await auditExternalQuality('outlab', 'laboratory.create', ctx.actor!.id, data.id, data.name)
    return NextResponse.json(data, { status: 201 })
  } catch (error) { return externalQualityError(error) }
}

