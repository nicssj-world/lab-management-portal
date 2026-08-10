import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalCustodian, requireChemicalViewer } from '@/lib/chemical-safety/access'
import { parseJson, unexpectedError } from '@/lib/chemical-safety/api'
import { chemicalChangeRequestSchema } from '@/lib/chemical-safety/schemas'
import { listChemicalChangeRequests } from '@/lib/chemical-safety/repository'
import { calculateHoldingTotalFromFields, isQuantityUnit } from '@/lib/chemical-safety/domain'
import { snakeProposal } from '@/lib/chemical-safety/proposal-keys'
import { supabaseAdmin } from '@/lib/supabase/admin'

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

function normalizeStoredProposal(
  entityType: string,
  proposal: Record<string, unknown> & {
    packageValue: number
    packageUnit: string
    currentContainerCount: number
    calculatedTotalValue?: unknown
    calculatedTotalUnit?: unknown
    storageScope?: 'room' | 'department'
  },
  unitId: string,
) {
  const normalized = withCalculatedQuantity(proposal)
  if (entityType !== 'holding') return normalized

  const withUnit = { ...normalized, unitId }
  // The original room-holding RPC predates storage_scope and validates an
  // exact snapshot. Keep that contract for room edits; department holdings
  // are dispatched by the new scope-aware wrapper during review.
  if (withUnit.storageScope === 'room') {
    const { storageScope: _storageScope, ...legacy } = withUnit
    return legacy
  }
  return withUnit
}

export async function GET() {
  const guard = await requireChemicalViewer()
  if (guard.response) return guard.response
  try {
    return NextResponse.json({ items: await listChemicalChangeRequests() })
  } catch (error) {
    return unexpectedError(error)
  }
}

export async function POST(request: NextRequest) {
  const input = await parseJson(request, chemicalChangeRequestSchema)
  if (input.response) return input.response
  if (input.data.entityType === 'new_chemical') {
    return NextResponse.json({
      error: 'registry_entry_required',
      message: 'กรุณาเพิ่มสารเคมีใหม่ด้วย registry-first workflow',
    }, { status: 409 })
  }
  const guard = await requireChemicalCustodian(input.data.unitId)
  if (guard.response) return guard.response
  try {
    // คำขอสร้างรายการใหม่ยังไม่มี entity ให้อ้างอิงจนกว่าจะผ่านการทบทวน
    const entityId = input.data.entityType === 'product' || input.data.entityType === 'holding' || input.data.entityType === 'holding_delete'
      ? input.data.entityId
      : null
    // holding_delete ไม่มีฟิลด์ปริมาณให้คำนวณ ส่งตรงเหมือน product ไม่ผ่าน normalizeStoredProposal
    const proposedData = input.data.entityType === 'product' || input.data.entityType === 'holding_delete'
      ? input.data.proposedData
      : normalizeStoredProposal(input.data.entityType, input.data.proposedData, input.data.unitId)
    const { data, error } = await supabaseAdmin.from('chemical_change_requests').insert({
      entity_type: input.data.entityType,
      entity_id: entityId,
      unit_id: input.data.unitId,
      proposed_data: snakeProposal(proposedData),
      status: 'draft',
      created_by: guard.actor.id,
    }).select('*').single()
    if (error) throw error
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) { return unexpectedError(error) }
}
