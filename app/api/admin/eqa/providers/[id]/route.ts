import { NextRequest, NextResponse } from 'next/server'
import { externalQualityContext, auditExternalQuality, externalQualityError } from '@/lib/external-quality/access'
import { providerSchema } from '@/lib/eqa/schemas'
import { providerPayload } from '@/lib/eqa/api'
import { supabaseAdmin } from '@/lib/supabase/admin'
type Params = { params: Promise<{ id: string }> }
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await externalQualityContext('eqa', true); if (ctx.response) return ctx.response
  try { const { id } = await params; const input = providerSchema.parse(await req.json()); const { data, error } = await supabaseAdmin.from('eqa_providers').update(providerPayload(input, ctx.actor!.id)).eq('id', id).select('*').single(); if (error) throw error; await auditExternalQuality('eqa','provider.update',ctx.actor!.id,id,data.name); return NextResponse.json(data) }
  catch (error) { return externalQualityError(error) }
}
export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await externalQualityContext('eqa', true); if (ctx.response) return ctx.response
  try { const { id } = await params; const { error } = await supabaseAdmin.from('eqa_providers').update({ active:false, updated_at:new Date().toISOString(), updated_by:ctx.actor!.id }).eq('id',id); if(error) throw error; await auditExternalQuality('eqa','provider.deactivate',ctx.actor!.id,id); return new NextResponse(null,{status:204}) }
  catch (error) { return externalQualityError(error) }
}
