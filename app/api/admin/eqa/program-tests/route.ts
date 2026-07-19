import { NextRequest,NextResponse } from 'next/server'
import { externalQualityContext,auditExternalQuality,externalQualityError } from '@/lib/external-quality/access'
import { programTestSchema } from '@/lib/eqa/schemas'
import { programTestPayload } from '@/lib/eqa/api'
import { supabaseAdmin } from '@/lib/supabase/admin'
export async function POST(req:NextRequest){const ctx=await externalQualityContext('eqa',true);if(ctx.response)return ctx.response;try{const input=programTestSchema.parse(await req.json());const{data,error}=await supabaseAdmin.from('eqa_program_tests').insert({...programTestPayload(input),created_by:ctx.actor!.id}).select('*').single();if(error)throw error;await auditExternalQuality('eqa','program_test.create',ctx.actor!.id,data.id,data.test_name_snapshot);return NextResponse.json(data,{status:201})}catch(error){return externalQualityError(error)}}
