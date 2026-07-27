import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { findPmCalGroupConflicts, getPmCalActor, writePmCalAudit } from '@/lib/equipment/pm-cal-server'
import { parsePmCalFiscalYear, pmCalPlanGroupReplaceSchema } from '@/lib/equipment/pm-cal-validation'
import { fiscalYearForDate } from '@/lib/equipment/pm-cal-domain'

export async function GET(req: NextRequest) {
  const actor = await getPmCalActor('read')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const fiscalYear = parsePmCalFiscalYear(req.nextUrl.searchParams.get('fiscalYear'), fiscalYearForDate(new Date()))
  if (fiscalYear == null) return NextResponse.json({ error: 'ปีงบประมาณไม่ถูกต้อง' }, { status: 422 })
  const [{ data: groups, error: groupError }, { data: equipment, error: equipmentError }, { data: plans, error: planError }] = await Promise.all([
    supabaseAdmin.from('equipment_pm_cal_plan_groups').select('*').eq('fiscal_year', fiscalYear).eq('record_status', 'active').order('group_name').order('plan_name'),
    supabaseAdmin.from('equipment').select('id, cbh_code, equipment_type, department, classification, needs_calibration, status').eq('needs_calibration', true).eq('status', 'Active').order('equipment_type'),
    supabaseAdmin.from('equipment_pm_cal_plans').select('id, equipment_id, plan_group_id, fiscal_year, calendar_month, cal_type, due_date, record_status, version').eq('fiscal_year', fiscalYear).eq('record_status', 'active'),
  ])
  const error = groupError ?? equipmentError ?? planError
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const planIds = (plans ?? []).map(plan => plan.id)
  const { data: results, error: resultError } = planIds.length
    ? await supabaseAdmin.from('equipment_calibrations').select('id, plan_id, equipment_id, cal_type, completed_date, result').in('plan_id', planIds)
    : { data: [], error: null }
  if (resultError) return NextResponse.json({ error: resultError.message }, { status: 500 })
  return NextResponse.json({ fiscal_year: fiscalYear, groups: groups ?? [], equipment: equipment ?? [], plans: plans ?? [], results: results ?? [] })
}

export async function POST(req: NextRequest) {
  const actor = await getPmCalActor('edit')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = pmCalPlanGroupReplaceSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลแผนกลุ่มไม่ถูกต้อง', issues: parsed.error.flatten() }, { status: 422 })
  const { equipment_ids, ...group } = parsed.data
  const conflicts = await findPmCalGroupConflicts({ equipmentIds: equipment_ids, fiscalYear: group.fiscal_year, calendarMonth: group.calendar_month, calType: group.cal_type })
  if (conflicts.length) return NextResponse.json({ error: 'เครื่องมือบางรายการมีแผน PM/CAL ซ้ำในเดือนนี้', conflicts }, { status: 409 })
  const { data, error } = await supabaseAdmin.rpc('replace_equipment_pm_cal_plan_group', {
    p_group: group, p_members: equipment_ids, p_expected_versions: {}, p_actor: actor.id,
  })
  if (error) {
    const status = error.code === '40001' || error.code === '23505' ? 409 : error.code === '23503' ? 422 : 500
    return NextResponse.json({ error: error.code === '23505' ? 'เครื่องมือบางรายการมีแผน PM/CAL ซ้ำในเดือนนี้' : error.message }, { status })
  }
  await writePmCalAudit(actor.id, 'equipment.pm_cal.group.create', String(data?.id ?? ''), `${group.plan_name} · ปีงบ ${group.fiscal_year} · ${equipment_ids.length} เครื่อง`)
  return NextResponse.json(data, { status: 201 })
}
