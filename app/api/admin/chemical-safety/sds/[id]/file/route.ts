import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalViewer } from '@/lib/chemical-safety/access'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { r2ObjectResponse } from '@/lib/r2/stream-response'
import { supabaseAdmin } from '@/lib/supabase/admin'

function safe(value:string){return value.replace(/[^\p{L}\p{N}._-]+/gu,'_').slice(0,180)||'SDS.pdf'}
export async function GET(request:NextRequest,ctx:RouteContext<'/api/admin/chemical-safety/sds/[id]/file'>){const guard=await requireChemicalViewer();if(guard.response)return guard.response;const{id}=await ctx.params;const{data:version}=await supabaseAdmin.from('chemical_sds_versions').select('file_id').eq('id',id).maybeSingle();if(!version?.file_id)return NextResponse.json({error:'Not found'},{status:404});const{data:file}=await supabaseAdmin.from('chemical_sds_files').select('r2_key,file_name,content_type').eq('id',version.file_id).maybeSingle();if(!file)return NextResponse.json({error:'Not found'},{status:404});const object=await r2.send(new GetObjectCommand({Bucket:R2_BUCKET,Key:file.r2_key,Range:request.headers.get('range')??undefined}));return r2ObjectResponse(object,{contentType:file.content_type,contentDisposition:`inline; filename="${safe(file.file_name)}"`})}
