import { NextRequest, NextResponse } from 'next/server'
import { externalQualityContext, auditExternalQuality, externalQualityError } from '@/lib/external-quality/access'
import { providerSchema } from '@/lib/eqa/schemas'
import { providerPayload } from '@/lib/eqa/api'
import { supabaseAdmin } from '@/lib/supabase/admin'
export async function POST(req: NextRequest) {
  const ctx = await externalQualityContext('eqa', true); if (ctx.response) return ctx.response
  try {
    const input = providerSchema.parse(await req.json())
    const { data, error } = await supabaseAdmin.from('eqa_providers').insert({ ...providerPayload(input, ctx.actor!.id), created_by: ctx.actor!.id }).select('*').single()
    if (error) throw error
    await auditExternalQuality('eqa', 'provider.create', ctx.actor!.id, data.id, data.name)
    return NextResponse.json(data, { status: 201 })
  } catch (error) { return externalQualityError(error) }
}
