import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalCustodian } from '@/lib/chemical-safety/access'
import { parseJson, unexpectedError } from '@/lib/chemical-safety/api'
import { chemicalChangeRequestSchema } from '@/lib/chemical-safety/schemas'
import { supabaseAdmin } from '@/lib/supabase/admin'

function snakeProposal(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), item]))
}

export async function POST(request: NextRequest) {
  const input = await parseJson(request, chemicalChangeRequestSchema)
  if (input.response) return input.response
  const guard = await requireChemicalCustodian(input.data.unitId)
  if (guard.response) return guard.response
  try {
    const { data, error } = await supabaseAdmin.from('chemical_change_requests').insert({
      entity_type: input.data.entityType,
      entity_id: input.data.entityId,
      unit_id: input.data.unitId,
      proposed_data: snakeProposal(input.data.proposedData),
      status: 'draft',
      created_by: guard.actor.id,
    }).select('*').single()
    if (error) throw error
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) { return unexpectedError(error) }
}
