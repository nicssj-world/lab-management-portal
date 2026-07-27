import { NextResponse, type NextRequest } from 'next/server'
import { parseJson, transitionError } from '@/lib/chemical-safety/api'
import { chemicalReviewSchema } from '@/lib/chemical-safety/schemas'
import { resolveSdsForReviewer } from '@/lib/chemical-safety/sds-workflow'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/admin/chemical-safety/sds/[id]/review'>,
) {
  const { id } = await ctx.params
  const input = await parseJson(request, chemicalReviewSchema)
  if (input.response) return input.response

  try {
    const resolved = await resolveSdsForReviewer(id)
    if (resolved.response) return resolved.response
    if (resolved.context.status !== 'in_review') {
      return NextResponse.json({ error: 'ทบทวนได้เฉพาะฉบับที่ส่งมาแล้ว' }, { status: 409 })
    }
    // RPC ก็กันไว้อีกชั้น แต่ต้องกันที่นี่ด้วยเพื่อให้ได้ 403 ที่สื่อความหมาย ไม่ใช่ 500
    if (resolved.context.submittedBy === resolved.actor.id) {
      return NextResponse.json({ error: 'ผู้ส่งไม่สามารถทบทวนฉบับของตนเอง' }, { status: 403 })
    }

    const { error } = await supabaseAdmin.rpc('review_chemical_sds_version', {
      p_version_id: id,
      p_actor_id: resolved.actor.id,
      p_decision: input.data.decision,
      p_reason: input.data.reason,
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return transitionError(error)
  }
}
