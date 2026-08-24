import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { definitionEditSchema } from '@/lib/validations/kpi-definition'
import { createKpiDefinitionVersion } from '@/lib/queries/kpi-compliance'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).maybeSingle()
  if (!data || data.role?.toLowerCase() !== 'admin') return null
  return data as { id: string; role: string }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const kpiId = Number(id)
  if (!Number.isInteger(kpiId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const parsed = definitionEditSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })

  const { effective_from_fiscal_year, effective_from_month, ...definitionBody } = parsed.data
  const { data, error } = await supabaseAdmin
    .from('kpi_definitions')
    .update(definitionBody)
    .eq('id', kpiId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    await createKpiDefinitionVersion(supabaseAdmin, data, {
      fiscalYear: effective_from_fiscal_year,
      month: effective_from_month,
    }, actor.id)
  } catch (versionError) {
    return NextResponse.json({ error: versionError instanceof Error ? versionError.message : 'สร้าง version ของ KPI ไม่สำเร็จ' }, { status: 500 })
  }

  supabaseAdmin.from('audit_log').insert({
    action: 'kpi.definition.update', user_id: actor.id, target: String(kpiId), detail: `แก้ไขตัวชี้วัด ${parsed.data.name_th}`,
  }).then(undefined, () => {})

  return NextResponse.json({ ...data, effective_from_fiscal_year, effective_from_month })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const kpiId = Number(id)
  if (!Number.isInteger(kpiId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  // Safety: block delete when historical entries reference this KPI (QMS data must not be lost)
  const { count } = await supabaseAdmin
    .from('kpi_entries')
    .select('id', { count: 'exact', head: true })
    .eq('kpi_id', kpiId)

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `ตัวชี้วัดนี้มีข้อมูลกรอกแล้ว ${count} รายการ — ลบไม่ได้ กรุณาลบข้อมูลก่อน หรือใช้การแก้ไขแทน` },
      { status: 409 }
    )
  }

  const { count: versionCount } = await supabaseAdmin
    .from('kpi_definition_versions')
    .select('id', { count: 'exact', head: true })
    .eq('kpi_id', kpiId)
  if ((versionCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'ตัวชี้วัดนี้มีประวัติ version แล้ว — ลบไม่ได้ กรุณาใช้การแก้ไขพร้อมระบุงวดเริ่มใช้แทน' },
      { status: 409 },
    )
  }

  // No entries → safe to delete (kpi_dept_exclusions rows cascade via FK)
  const { error } = await supabaseAdmin.from('kpi_definitions').delete().eq('id', kpiId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'kpi.definition.delete', user_id: actor.id, target: String(kpiId), detail: 'ลบตัวชี้วัด',
  }).then(undefined, () => {})

  return NextResponse.json({ ok: true })
}
