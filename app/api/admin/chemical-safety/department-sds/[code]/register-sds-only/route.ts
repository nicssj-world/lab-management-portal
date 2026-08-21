import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalCustodian } from '@/lib/chemical-safety/access'
import { unexpectedError } from '@/lib/chemical-safety/api'
import { supabaseAdmin } from '@/lib/supabase/admin'

function registerError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof (error as { message?: unknown })?.message === 'string'
      ? String((error as { message: string }).message)
      : String(error)

  if (/department_sds_not_found|department_sds_file_not_found/i.test(message)) {
    return NextResponse.json({ error: 'ไม่พบไฟล์ SDS หรือไฟล์อ้างอิงของรายการนี้' }, { status: 404 })
  }
  if (/department_sds_already_linked/i.test(message)) {
    return NextResponse.json({ error: 'ไฟล์ SDS นี้อยู่ในทะเบียนสารเคมีแล้ว' }, { status: 409 })
  }
  if (/department_sds_unit_not_found/i.test(message)) {
    return NextResponse.json({ error: 'ยังไม่มีหน่วยงานเคมีที่ตรงกับงานนี้' }, { status: 422 })
  }
  if (/department_sds_display_name_required/i.test(message)) {
    return NextResponse.json({ error: 'ไฟล์ SDS นี้ยังไม่มีชื่อสารเคมี' }, { status: 422 })
  }
  return unexpectedError(error)
}

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code: departmentSdsId } = await ctx.params

  try {
    const entry = await supabaseAdmin
      .from('chemical_department_sds')
      .select('id, department_code, file_id')
      .eq('id', departmentSdsId)
      .maybeSingle()
    if (entry.error) throw entry.error
    if (!entry.data) return NextResponse.json({ error: 'ไม่พบไฟล์ SDS' }, { status: 404 })
    if (!entry.data.file_id) return NextResponse.json({ error: 'ไฟล์ SDS นี้ยังไม่มีไฟล์อ้างอิง' }, { status: 422 })

    const department = await supabaseAdmin
      .from('chemical_sds_departments')
      .select('department')
      .eq('code', entry.data.department_code)
      .maybeSingle()
    if (department.error) throw department.error
    if (!department.data) return NextResponse.json({ error: 'ไม่พบข้อมูลหน่วยงาน' }, { status: 404 })

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

    const registered = await supabaseAdmin.rpc('register_department_sds_as_sds_only', {
      p_department_sds_id: departmentSdsId,
      p_actor_id: guard.actor.id,
    })
    if (registered.error) return registerError(registered.error)
    if (typeof registered.data !== 'string') throw new Error('register_department_sds_as_sds_only returned no link id')

    return NextResponse.json({
      data: {
        linkId: registered.data,
        inventoryCaptureStatus: 'sds_only',
        label: 'SDS-only — ยังไม่ระบุปริมาณ',
      },
    })
  } catch (error) {
    return registerError(error)
  }
}
