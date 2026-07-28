import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { findPmCalGroupConflicts, getPmCalActor, writePmCalAudit } from '@/lib/equipment/pm-cal-server'
import { pmCalPlanGroupReplaceSchema } from '@/lib/equipment/pm-cal-validation'

interface Params { params: Promise<{ groupId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await getPmCalActor('edit')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { groupId } = await params
  const parsed = pmCalPlanGroupReplaceSchema.safeParse({ ...(await req.json().catch(() => null)), id: groupId })
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลแผนกลุ่มไม่ถูกต้อง', issues: parsed.error.flatten() }, { status: 422 })
  const { equipment_ids, ...group } = parsed.data
  const conflicts = await findPmCalGroupConflicts({ equipmentIds: equipment_ids, fiscalYear: group.fiscal_year, calendarMonth: group.calendar_month, calType: group.cal_type, excludeGroupId: groupId })
  if (conflicts.length) return NextResponse.json({ error: group.cal_type === 'CAL' ? 'เครื่องมือบางรายการมีแผน CAL ที่ยังไม่ปิดอยู่แล้วในปีงบนี้' : 'เครื่องมือบางรายการมีแผน PM/CAL ซ้ำในเดือนนี้', conflicts }, { status: 409 })
  const { data, error } = await supabaseAdmin.rpc('replace_equipment_pm_cal_plan_group', {
    p_group: group, p_members: equipment_ids, p_expected_versions: {}, p_actor: actor.id,
  })
  if (error) {
    const status = error.code === '40001' || error.code === '23505' ? 409 : error.code === '23503' ? 422 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  await writePmCalAudit(actor.id, 'equipment.pm_cal.group.update', groupId, `${group.plan_name} · ${equipment_ids.length} เครื่อง`)
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const actor = await getPmCalActor('edit')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { groupId } = await params
  const version = Number(req.nextUrl.searchParams.get('version'))
  if (!Number.isInteger(version) || version < 1) return NextResponse.json({ error: 'version ไม่ถูกต้อง' }, { status: 422 })
  const { error } = await supabaseAdmin.rpc('cancel_equipment_pm_cal_plan_group', { p_group_id: groupId, p_version: version, p_actor: actor.id })
  if (error) {
    const status = error.code === '40001' ? 409 : error.code === '23503' ? 409 : 500
    return NextResponse.json({ error: error.code === '23503' ? 'ยกเลิกกลุ่มไม่ได้ เพราะมีผลการดำเนินงานแล้ว' : error.message }, { status })
  }
  await writePmCalAudit(actor.id, 'equipment.pm_cal.group.cancel', groupId, `ยกเลิกแผนกลุ่ม version ${version}`)
  return NextResponse.json({ ok: true })
}
