import { NextRequest, NextResponse } from 'next/server'
import { externalQualityContext, auditExternalQuality, externalQualityError } from '@/lib/external-quality/access'
import { programSchema } from '@/lib/eqa/schemas'
import { programPayload, syncProgramOwners } from '@/lib/eqa/api'
import { supabaseAdmin } from '@/lib/supabase/admin'
export async function POST(req: NextRequest) {
  const ctx = await externalQualityContext('eqa', true); if (ctx.response) return ctx.response
  try {
    const input = programSchema.parse(await req.json())
    const { data, error } = await supabaseAdmin.from('eqa_programs').insert({ ...programPayload(input,ctx.actor!.id), created_by:ctx.actor!.id }).select('*').single(); if(error) throw error
    try { await syncProgramOwners(data.id,input) } catch(error) { await supabaseAdmin.from('eqa_programs').delete().eq('id',data.id); throw error }
    await auditExternalQuality('eqa','program.create',ctx.actor!.id,data.id,data.name); return NextResponse.json(data,{status:201})
  } catch(error) { return externalQualityError(error) }
}
