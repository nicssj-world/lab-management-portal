import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalCustodian } from '@/lib/chemical-safety/access'
import { parseJson, transitionError, unexpectedError } from '@/lib/chemical-safety/api'
import { chemicalChangeDraftPatchSchema, chemicalHoldingProposalSchema, chemicalProductProposalSchema, chemicalSubmitSchema } from '@/lib/chemical-safety/schemas'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function loadRequest(id: string) {
  return supabaseAdmin.from('chemical_change_requests').select('*').eq('id', id).maybeSingle()
}

function snakeProposal(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), item]))
}

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/admin/chemical-safety/change-requests/[id]/submit'>) {
  const { id } = await ctx.params
  const input = await parseJson(request, chemicalChangeDraftPatchSchema)
  if (input.response) return input.response
  const current = await loadRequest(id)
  if (current.error) return unexpectedError(current.error)
  if (!current.data) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
  const guard = await requireChemicalCustodian(current.data.unit_id)
  if (guard.response) return guard.response
  if (current.data.status !== 'draft' || current.data.updated_at !== input.data.updatedAt) {
    return NextResponse.json({ error: 'ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดใหม่' }, { status: 409 })
  }
  const proposalSchema = current.data.entity_type === 'product' ? chemicalProductProposalSchema : chemicalHoldingProposalSchema
  const proposal = proposalSchema.safeParse(input.data.proposedData)
  if (!proposal.success) return NextResponse.json({ error: 'ข้อมูลข้อเสนอไม่ครบ', issues: proposal.error.flatten() }, { status: 422 })
  try {
    const { data, error } = await supabaseAdmin.from('chemical_change_requests').update({ proposed_data: snakeProposal(proposal.data), updated_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'draft').eq('updated_at', input.data.updatedAt).select('*').maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดใหม่' }, { status: 409 })
    return NextResponse.json({ data })
  } catch (error) { return unexpectedError(error) }
}

export async function POST(request: NextRequest, ctx: RouteContext<'/api/admin/chemical-safety/change-requests/[id]/submit'>) {
  const { id } = await ctx.params
  const input = await parseJson(request, chemicalSubmitSchema)
  if (input.response) return input.response
  const current = await loadRequest(id)
  if (current.error) return unexpectedError(current.error)
  if (!current.data) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
  const guard = await requireChemicalCustodian(current.data.unit_id)
  if (guard.response) return guard.response
  const schema = current.data.entity_type === 'product' ? chemicalProductProposalSchema : chemicalHoldingProposalSchema
  if (!schema.safeParse(current.data.proposed_data).success) return NextResponse.json({ error: 'ข้อมูลข้อเสนอไม่ครบ' }, { status: 422 })
  try {
    const { error } = await supabaseAdmin.rpc('submit_chemical_change_request', { p_request_id: id, p_actor_id: guard.actor.id })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) { return transitionError(error) }
}
