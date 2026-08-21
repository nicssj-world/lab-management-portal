import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalCustodian, requireChemicalViewer } from '@/lib/chemical-safety/access'
import { parseJson, queryObject, unexpectedError, validationError } from '@/lib/chemical-safety/api'
import { listInternalSds } from '@/lib/chemical-safety/repository'
import { chemicalSdsCreateSchema, internalSdsQuerySchema } from '@/lib/chemical-safety/schemas'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const guard = await requireChemicalViewer()
  if (guard.response) return guard.response
  const parsed = internalSdsQuerySchema.safeParse(queryObject(request.nextUrl.searchParams))
  if (!parsed.success) return validationError(parsed.error)
  try {
    return NextResponse.json({ items: await listInternalSds(parsed.data) })
  } catch (error) {
    return unexpectedError(error)
  }
}

export async function POST(request: NextRequest) {
  const input = await parseJson(request, chemicalSdsCreateSchema)
  if (input.response) return input.response

  try {
    // holding เป็น source of truth ของ product, unit และปลายทาง ห้ามเชื่อค่าคู่อ้างอิงจาก client
    const holding = await supabaseAdmin
      .from('chemical_inventory_holdings')
      .select('id, product_id, unit_id, storage_scope')
      .eq('id', input.data.holdingId)
      .maybeSingle()
    if (holding.error) throw holding.error
    if (!holding.data) return NextResponse.json({ error: 'ไม่พบรายการทะเบียนสารเคมี' }, { status: 404 })

    const guard = await requireChemicalCustodian(String(holding.data.unit_id))
    if (guard.response) return guard.response

    const inserted = await supabaseAdmin
      .from('chemical_sds_versions')
      .insert({
        product_id: holding.data.product_id,
        source_holding_id: holding.data.id,
        workflow_origin: 'registry_v2',
        language: input.data.language,
        revision_label: input.data.revisionLabel ?? null,
        status: 'draft',
        created_by: guard.actor.id,
      })
      .select('id, created_at, updated_at')
      .single()
    if (inserted.error) throw inserted.error

    supabaseAdmin.from('audit_log').insert({
      action: 'chemical_safety.sds.create_draft',
      user_id: guard.actor.id,
      target: inserted.data.id,
      detail: JSON.stringify({
        holdingId: holding.data.id,
        productId: holding.data.product_id,
        unitId: holding.data.unit_id,
        storageScope: holding.data.storage_scope,
      }),
    }).then(undefined, () => {})

    return NextResponse.json({
      id: inserted.data.id,
      createdAt: inserted.data.created_at,
      updatedAt: inserted.data.updated_at,
    }, { status: 201 })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return NextResponse.json({ error: 'รายการนี้มีฉบับร่างหรือกำลังดำเนินการอยู่แล้ว' }, { status: 409 })
    }
    return unexpectedError(error)
  }
}
