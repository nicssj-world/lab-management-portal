import { NextRequest, NextResponse } from 'next/server'
import { externalQualityContext, auditExternalQuality, externalQualityError } from '@/lib/external-quality/access'
import { serviceSchema } from '@/lib/outlab/schemas'
import { assertOutlabCatalogTest, servicePayload } from '@/lib/outlab/api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const ctx = await externalQualityContext('outlab', true); if (ctx.response) return ctx.response
  try {
    const input = serviceSchema.parse(await req.json())
    await assertOutlabCatalogTest(input.testId)
    const { data, error } = await supabaseAdmin.from('outlab_services').insert({ ...servicePayload(input, ctx.actor!.id), created_by: ctx.actor!.id }).select('*').single()
    if (error) throw error
    await auditExternalQuality('outlab', 'service.create', ctx.actor!.id, data.id, data.test_name_snapshot)
    return NextResponse.json(data, { status: 201 })
  } catch (error) { return externalQualityError(error) }
}
