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

  const guard = await requireChemicalCustodian(input.data.unitId)
  if (guard.response) return guard.response

  try {
    // สารต้องอยู่ในหน่วยที่ผู้ใช้ดูแลจริง ไม่ใช่แค่ส่ง unitId ที่ตัวเองมีสิทธิ์มาคู่กับสารอะไรก็ได้
    const link = await supabaseAdmin
      .from('chemical_inventory_holdings')
      .select('id')
      .eq('product_id', input.data.productId)
      .eq('unit_id', input.data.unitId)
      .eq('storage_scope', 'room')
      .limit(1)
      .maybeSingle()
    if (link.error) throw link.error
    if (!link.data) return NextResponse.json({ error: 'สารเคมีนี้ไม่ได้อยู่ในห้องสารเคมีของหน่วยงานที่เลือก' }, { status: 422 })

    const inserted = await supabaseAdmin
      .from('chemical_sds_versions')
      .insert({
        product_id: input.data.productId,
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
      detail: JSON.stringify({ productId: input.data.productId, unitId: input.data.unitId }),
    }).then(undefined, () => {})

    return NextResponse.json({
      id: inserted.data.id,
      createdAt: inserted.data.created_at,
      updatedAt: inserted.data.updated_at,
    }, { status: 201 })
  } catch (error) {
    return unexpectedError(error)
  }
}
