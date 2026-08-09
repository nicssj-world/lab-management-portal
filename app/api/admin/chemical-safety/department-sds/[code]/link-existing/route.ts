import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireChemicalCustodian } from '@/lib/chemical-safety/access'
import { parseJson, unexpectedError } from '@/lib/chemical-safety/api'
import { supabaseAdmin } from '@/lib/supabase/admin'

const linkExistingSchema = z.object({
  holdingId: z.string().uuid(),
}).strict()

function linkError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof (error as { message?: unknown })?.message === 'string'
      ? String((error as { message: string }).message)
      : String(error)

  if (/department_(sds|holding)_not_found/i.test(message)) {
    return NextResponse.json({ error: 'ไม่พบไฟล์ SDS หรือรายการถือครองที่เลือก' }, { status: 404 })
  }
  if (/department_sds_already_linked/i.test(message)) {
    return NextResponse.json({ error: 'ไฟล์ SDS นี้ถูกผูกกับทะเบียนแล้ว กรุณาโหลดข้อมูลใหม่' }, { status: 409 })
  }
  if (/department_holding_already_linked/i.test(message)) {
    return NextResponse.json({ error: 'รายการถือครองนี้มีไฟล์ SDS งานผูกอยู่แล้ว กรุณาเลือกรายการอื่น' }, { status: 409 })
  }
  if (/department_sds_(file|unit)_not_found|department_holding_(wrong_scope|wrong_unit|inactive)/i.test(message)) {
    return NextResponse.json({ error: 'ไฟล์ SDS และรายการทะเบียนไม่ตรงกับหน่วยงานหรือไม่พร้อมใช้งาน' }, { status: 422 })
  }
  return unexpectedError(error)
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code: departmentSdsId } = await ctx.params
  const input = await parseJson(request, linkExistingSchema)
  if (input.response) return input.response

  try {
    const entry = await supabaseAdmin
      .from('chemical_department_sds')
      .select('id, department_code')
      .eq('id', departmentSdsId)
      .maybeSingle()
    if (entry.error) throw entry.error
    if (!entry.data) return NextResponse.json({ error: 'ไม่พบไฟล์ SDS' }, { status: 404 })

    const department = await supabaseAdmin
      .from('chemical_sds_departments')
      .select('department')
      .eq('code', entry.data.department_code)
      .maybeSingle()
    if (department.error) throw department.error
    if (!department.data) return NextResponse.json({ error: 'ไม่พบข้อมูลงาน' }, { status: 404 })

    const unit = await supabaseAdmin
      .from('chemical_units')
      .select('id')
      .eq('name_th', department.data.department)
      .eq('active', true)
      .maybeSingle()
    if (unit.error) throw unit.error
    if (!unit.data) return NextResponse.json({ error: 'ยังไม่มีหน่วยงานเคมีที่ตรงกับงานนี้' }, { status: 422 })

    const guard = await requireChemicalCustodian(String(unit.data.id))
    if (guard.response) return guard.response

    const linked = await supabaseAdmin.rpc('link_department_sds_to_existing_holding', {
      p_department_sds_id: departmentSdsId,
      p_holding_id: input.data.holdingId,
      p_actor_id: guard.actor.id,
    })
    if (linked.error) return linkError(linked.error)
    if (typeof linked.data !== 'string') throw new Error('link_department_sds_to_existing_holding returned no link id')

    return NextResponse.json({ data: { linkId: linked.data } })
  } catch (error) {
    return linkError(error)
  }
}
