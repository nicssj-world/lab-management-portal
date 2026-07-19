import { NextRequest,NextResponse } from 'next/server'
import { externalQualityContext,auditExternalQuality,externalQualityError } from '@/lib/external-quality/access'
import { roundSchema } from '@/lib/eqa/schemas'
import { roundPayload } from '@/lib/eqa/api'
import { supabaseAdmin } from '@/lib/supabase/admin'
export async function POST(req:NextRequest){const ctx=await externalQualityContext('eqa',true);if(ctx.response)return ctx.response;try{const input=roundSchema.parse(await req.json());if(input.status!=='planned')return NextResponse.json({error:'รอบใหม่ต้องเริ่มที่สถานะ planned'},{status:422});const{data,error}=await supabaseAdmin.from('eqa_rounds').insert({...roundPayload(input,ctx.actor!.id),created_by:ctx.actor!.id}).select('*').single();if(error)throw error;await auditExternalQuality('eqa','round.create',ctx.actor!.id,data.id,data.round_code);return NextResponse.json(data,{status:201})}catch(error){return externalQualityError(error)}}
