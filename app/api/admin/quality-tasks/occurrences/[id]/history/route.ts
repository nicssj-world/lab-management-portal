import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx=await qualityTaskContext('view'); if(ctx.response)return ctx.response
  try {
    const id=(await params).id
    const {data,error}=await supabaseAdmin.from('audit_log').select('id,action,detail,created_at,user_id').eq('target',id).like('action','quality_task.%').order('created_at',{ascending:false}).limit(100)
    if(error)throw error
    const ids=[...new Set((data??[]).map((row:any)=>row.user_id).filter(Boolean))]
    const {data:profiles}=ids.length?await supabaseAdmin.from('profiles').select('id,name').in('id',ids):{data:[]}
    const names=new Map((profiles??[]).map((p:any)=>[p.id,p.name]))
    return NextResponse.json({history:(data??[]).map((row:any)=>({...row,actor_name:names.get(row.user_id)??null}))})
  } catch(error){return qualityTaskError(error)}
}
