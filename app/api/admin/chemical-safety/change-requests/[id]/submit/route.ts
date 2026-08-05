import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalCustodian } from '@/lib/chemical-safety/access'
import { parseJson, transitionError, unexpectedError } from '@/lib/chemical-safety/api'
import {
  chemicalChangeDraftPatchSchema,
  chemicalHoldingProposalSchema,
  chemicalNewChemicalProposalSchema,
  chemicalProductProposalSchema,
  chemicalSubmitSchema,
} from '@/lib/chemical-safety/schemas'
import { calculateHoldingTotalFromFields, isQuantityUnit } from '@/lib/chemical-safety/domain'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ZodTypeAny } from 'zod'

async function loadRequest(id: string) {
  return supabaseAdmin.from('chemical_change_requests').select('*').eq('id', id).maybeSingle()
}

function snakeProposal(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), item]))
}

function camelProposal(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase()), item]),
  )
}

function withCalculatedQuantity<T extends {
  packageValue: number
  packageUnit: string
  currentContainerCount: number
  calculatedTotalValue?: unknown
  calculatedTotalUnit?: unknown
}>(proposal: T) {
  const calculated = typeof proposal.calculatedTotalValue === 'number' && isQuantityUnit(proposal.calculatedTotalUnit)
    ? { value: proposal.calculatedTotalValue, unit: proposal.calculatedTotalUnit }
    : calculateHoldingTotalFromFields(proposal)
  return {
    ...proposal,
    reportedTotalRaw: null,
    calculatedTotalValue: calculated?.value ?? null,
    calculatedTotalUnit: calculated?.unit ?? null,
  }
}

function proposalSchemaFor(entityType: string): ZodTypeAny {
  if (entityType === 'product') return chemicalProductProposalSchema
  if (entityType === 'new_chemical') return chemicalNewChemicalProposalSchema
  return chemicalHoldingProposalSchema
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
  const proposal = proposalSchemaFor(current.data.entity_type).safeParse(input.data.proposedData)
  if (!proposal.success) return NextResponse.json({ error: 'ข้อมูลข้อเสนอไม่ครบ', issues: proposal.error.flatten() }, { status: 422 })
  try {
    const proposedData = current.data.entity_type === 'product'
      ? proposal.data
      : withCalculatedQuantity(proposal.data)
    const { data, error } = await supabaseAdmin.from('chemical_change_requests').update({ proposed_data: snakeProposal(proposedData), updated_at: new Date().toISOString() })
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
  const rawProposal = current.data.proposed_data
  const candidateProposal = rawProposal && typeof rawProposal === 'object' && !Array.isArray(rawProposal)
    ? camelProposal(rawProposal as Record<string, unknown>)
    : rawProposal
  const proposal = proposalSchemaFor(current.data.entity_type).safeParse(candidateProposal)
  if (!proposal.success) return NextResponse.json({ error: 'ข้อมูลข้อเสนอไม่ครบ' }, { status: 422 })
  try {
    const proposedData = current.data.entity_type === 'product'
      ? proposal.data
      : withCalculatedQuantity(proposal.data)
    if (current.data.status === 'draft') {
      const normalized = await supabaseAdmin.from('chemical_change_requests')
        .update({ proposed_data: snakeProposal(proposedData), updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'draft')
      if (normalized.error) throw normalized.error
    }
    const { error } = await supabaseAdmin.rpc('submit_chemical_change_request', { p_request_id: id, p_actor_id: guard.actor.id })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) { return transitionError(error) }
}
