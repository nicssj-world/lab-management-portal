import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalReviewer } from '@/lib/chemical-safety/access'
import { parseJson, transitionError, unexpectedError } from '@/lib/chemical-safety/api'
import { chemicalReviewSchema } from '@/lib/chemical-safety/schemas'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest, ctx: RouteContext<'/api/admin/chemical-safety/change-requests/[id]/review'>) {
  const { id } = await ctx.params
  const input = await parseJson(request, chemicalReviewSchema)
  if (input.response) return input.response
  const current = await supabaseAdmin.from('chemical_change_requests').select('id, unit_id, status, submitted_by').eq('id', id).maybeSingle()
  if (current.error) return unexpectedError(current.error)
  if (!current.data) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
  const guard = await requireChemicalReviewer(current.data.unit_id)
  if (guard.response) return guard.response
  if (current.data.submitted_by === guard.actor.id) return NextResponse.json({ error: 'ผู้ส่งคำขอไม่สามารถอนุมัติคำขอของตนเอง' }, { status: 403 })
  try {
    const { error } = await supabaseAdmin.rpc('review_chemical_change_request', {
      p_request_id: id,
      p_actor_id: guard.actor.id,
      p_decision: input.data.decision,
      p_reason: input.data.reason,
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) { return transitionError(error) }
}
