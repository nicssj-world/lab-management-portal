import { NextResponse, type NextRequest } from 'next/server'
import type { z } from 'zod'
import { requireChemicalCustodian } from '@/lib/chemical-safety/access'
import { parseJson, unexpectedError } from '@/lib/chemical-safety/api'
import { normalizeCasNumber, normalizeChemicalName, calculateHoldingTotalFromFields } from '@/lib/chemical-safety/domain'
import { chemicalDepartmentChemicalProposalSchema } from '@/lib/chemical-safety/schemas'
import { snakeProposal } from '@/lib/chemical-safety/proposal-keys'
import { supabaseAdmin } from '@/lib/supabase/admin'

const registrationBodySchema = chemicalDepartmentChemicalProposalSchema.omit({ sourceDepartmentSdsId: true })

function withCalculatedQuantity(proposal: z.infer<typeof registrationBodySchema>) {
  const calculated = calculateHoldingTotalFromFields(proposal)
  return {
    ...proposal,
    productId: proposal.productId ?? null,
    sourceDepartmentSdsId: undefined,
    reportedTotalRaw: null,
    calculatedTotalValue: calculated?.value ?? null,
    calculatedTotalUnit: calculated?.unit ?? null,
  }
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code: departmentSdsId } = await ctx.params
  const input = await parseJson(request, registrationBodySchema)
  if (input.response) return input.response

  try {
    const entry = await supabaseAdmin
      .from('chemical_department_sds')
      .select('id, department_code, file_id')
      .eq('id', departmentSdsId)
      .maybeSingle()
    if (entry.error) throw entry.error
    if (!entry.data) return NextResponse.json({ error: 'ไม่พบเอกสาร SDS' }, { status: 404 })
    if (!entry.data.file_id) return NextResponse.json({ error: 'ไฟล์ SDS นี้ยังไม่มีไฟล์อ้างอิง' }, { status: 422 })

    const department = await supabaseAdmin
      .from('chemical_sds_departments')
      .select('code, department')
      .eq('code', entry.data.department_code)
      .maybeSingle()
    if (department.error) throw department.error
    if (!department.data) return NextResponse.json({ error: 'ไม่พบข้อมูลงาน' }, { status: 404 })

    const unit = await supabaseAdmin
      .from('chemical_units')
      .select('id, name_th, active')
      .eq('name_th', department.data.department)
      .eq('active', true)
      .maybeSingle()
    if (unit.error) throw unit.error
    if (!unit.data) return NextResponse.json({ error: 'ยังไม่มีหน่วยงานเคมีที่ตรงกับงานนี้' }, { status: 422 })

    const guard = await requireChemicalCustodian(String(unit.data.id))
    if (guard.response) return guard.response

    const linked = await supabaseAdmin
      .from('chemical_department_chemical_links')
      .select('id')
      .eq('department_sds_id', departmentSdsId)
      .maybeSingle()
    if (linked.error) throw linked.error
    if (linked.data) return NextResponse.json({ error: 'ไฟล์นี้อยู่ในทะเบียนสารเคมีแล้ว' }, { status: 409 })

    const pending = await supabaseAdmin
      .from('chemical_change_requests')
      .select('id, status, proposed_data')
      .eq('entity_type', 'department_chemical')
      .eq('unit_id', unit.data.id)
      .in('status', ['draft', 'in_review'])
    if (pending.error) throw pending.error
    if ((pending.data ?? []).some(row => row.proposed_data?.source_department_sds_id === departmentSdsId)) {
      return NextResponse.json({ error: 'ไฟล์นี้มีคำขอเข้าสู่ทะเบียนค้างอยู่แล้ว' }, { status: 409 })
    }

    let selectedProduct: Record<string, unknown> | null = null
    if (input.data.productId) {
      const product = await supabaseAdmin
        .from('chemical_products')
        .select('id, canonical_name, cas_number, manufacturer, supplier, product_code, concentration, physical_state, ghs_source_text, ghs_pictogram_codes, ghs_hazard_classes, lifecycle_status')
        .eq('id', input.data.productId)
        .maybeSingle()
      if (product.error) throw product.error
      if (!product.data) return NextResponse.json({ error: 'ไม่พบสารเคมีที่เลือก' }, { status: 422 })
      if (product.data.lifecycle_status !== 'active') {
        return NextResponse.json({ error: 'เลือกได้เฉพาะสารที่ยังใช้งานอยู่' }, { status: 422 })
      }
      selectedProduct = product.data as Record<string, unknown>
    } else {
      const products = await supabaseAdmin
        .from('chemical_products')
        .select('id, canonical_name, cas_number')
        .eq('lifecycle_status', 'active')
      if (products.error) throw products.error
      const name = normalizeChemicalName(input.data.canonicalName)
      const cas = normalizeCasNumber(input.data.casNumber)
      const candidates = (products.data ?? []).filter(product => (
        normalizeChemicalName(String(product.canonical_name)) === name
        || (cas !== null && normalizeCasNumber(product.cas_number ? String(product.cas_number) : null) === cas)
      )).map(product => ({ id: String(product.id), name: String(product.canonical_name) }))
      if (candidates.length > 0) {
        return NextResponse.json({ error: 'พบสารที่อาจซ้ำ กรุณาเลือกสารเดิมจากทะเบียน', candidates }, { status: 409 })
      }
    }

    const proposedData = {
      ...withCalculatedQuantity(input.data),
      sourceDepartmentSdsId: departmentSdsId,
      storageScope: 'department' as const,
      locationId: null,
    }
    if (selectedProduct) {
      Object.assign(proposedData, {
        canonicalName: String(selectedProduct.canonical_name),
        casNumber: selectedProduct.cas_number == null ? null : String(selectedProduct.cas_number),
        manufacturer: selectedProduct.manufacturer == null ? null : String(selectedProduct.manufacturer),
        supplier: selectedProduct.supplier == null ? null : String(selectedProduct.supplier),
        productCode: selectedProduct.product_code == null ? null : String(selectedProduct.product_code),
        concentration: selectedProduct.concentration == null ? null : String(selectedProduct.concentration),
        physicalState: selectedProduct.physical_state == null ? null : String(selectedProduct.physical_state),
        ghsSourceText: selectedProduct.ghs_source_text == null ? null : String(selectedProduct.ghs_source_text),
        ghsPictogramCodes: Array.isArray(selectedProduct.ghs_pictogram_codes) ? selectedProduct.ghs_pictogram_codes : [],
        ghsHazardClasses: Array.isArray(selectedProduct.ghs_hazard_classes) ? selectedProduct.ghs_hazard_classes : [],
      })
    }
    const inserted = await supabaseAdmin
      .from('chemical_change_requests')
      .insert({
        entity_type: 'department_chemical',
        entity_id: null,
        unit_id: unit.data.id,
        proposed_data: snakeProposal(proposedData),
        status: 'draft',
        created_by: guard.actor.id,
      })
      .select('*')
      .single()
    if (inserted.error) throw inserted.error
    return NextResponse.json({ data: inserted.data }, { status: 201 })
  } catch (error) {
    return unexpectedError(error)
  }
}
