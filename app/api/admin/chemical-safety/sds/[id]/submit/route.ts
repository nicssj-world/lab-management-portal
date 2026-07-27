import { NextResponse, type NextRequest } from 'next/server'
import { transitionError } from '@/lib/chemical-safety/api'
import { resolveSdsForCustodian } from '@/lib/chemical-safety/sds-workflow'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(
  _request: NextRequest,
  ctx: RouteContext<'/api/admin/chemical-safety/sds/[id]/submit'>,
) {
  const { id } = await ctx.params
  try {
    const resolved = await resolveSdsForCustodian(id)
    if (resolved.response) return resolved.response
    if (resolved.context.status !== 'draft') {
      return NextResponse.json({ error: 'ส่งทบทวนได้เฉพาะฉบับร่าง' }, { status: 409 })
    }

    // ไฟล์ SDS คือสาระของเอกสาร ส่งทบทวนโดยไม่มีไฟล์แล้วผู้ทบทวนก็ไม่มีอะไรให้ตรวจ
    const version = await supabaseAdmin
      .from('chemical_sds_versions')
      .select('file_id')
      .eq('id', id)
      .maybeSingle()
    if (version.error) throw version.error
    if (!version.data?.file_id) {
      return NextResponse.json({ error: 'กรุณาแนบไฟล์ SDS ก่อนส่งทบทวน' }, { status: 422 })
    }

    const { error } = await supabaseAdmin.rpc('submit_chemical_sds_version', {
      p_version_id: id,
      p_actor_id: resolved.actor.id,
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return transitionError(error)
  }
}
