import { NextRequest,NextResponse } from 'next/server'
import { externalQualityContext,auditExternalQuality,externalQualityError } from '@/lib/external-quality/access'
import { programTestSchema } from '@/lib/eqa/schemas'
import { programTestPayload } from '@/lib/eqa/api'
import { supabaseAdmin } from '@/lib/supabase/admin'
type Params={params:Promise<{id:string}>}
export async function PATCH(req:NextRequest,{params}:Params){const ctx=await externalQualityContext('eqa',true);if(ctx.response)return ctx.response;try{const{id}=await params;const input=programTestSchema.parse(await req.json());const{data,error}=await supabaseAdmin.from('eqa_program_tests').update(programTestPayload(input)).eq('id',id).select('*').single();if(error)throw error;await auditExternalQuality('eqa','program_test.update',ctx.actor!.id,id,data.test_name_snapshot);return NextResponse.json(data)}catch(error){return externalQualityError(error)}}
export async function DELETE(_req:NextRequest,{params}:Params){const ctx=await externalQualityContext('eqa',true);if(ctx.response)return ctx.response;try{const{id}=await params;const{error}=await supabaseAdmin.from('eqa_program_tests').update({active:false}).eq('id',id);if(error)throw error;await auditExternalQuality('eqa','program_test.deactivate',ctx.actor!.id,id);return new NextResponse(null,{status:204})}catch(error){return externalQualityError(error)}}
