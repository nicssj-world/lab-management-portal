import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalCustodian } from '@/lib/chemical-safety/access'
import { parseJson, transitionError, unexpectedError } from '@/lib/chemical-safety/api'
import { chemicalSdsPublicationSchema } from '@/lib/chemical-safety/schemas'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/admin/chemical-safety/registry/[holdingId]/sds-publication'>,
) {
  const { holdingId } = await ctx.params
  const input = await parseJson(request, chemicalSdsPublicationSchema)
  if (input.response) return input.response

  const holding = await supabaseAdmin
    .from('chemical_inventory_holdings')
    .select('id, unit_id')
    .eq('id', holdingId)
    .maybeSingle()
  if (holding.error) return unexpectedError(holding.error)
  if (!holding.data) return NextResponse.json({ error: 'ไม่พบรายการทะเบียนสารเคมี' }, { status: 404 })

  const guard = await requireChemicalCustodian(String(holding.data.unit_id))
  if (guard.response) return guard.response

  try {
    const result = await supabaseAdmin.rpc('link_chemical_sds_publication', {
      p_holding_id: holdingId,
      p_sds_version_id: input.data.sdsVersionId,
      p_actor_id: guard.actor.id,
    })
    if (result.error) throw result.error
    return NextResponse.json({ id: result.data }, { status: 201 })
  } catch (error) {
    return transitionError(error)
  }
}

