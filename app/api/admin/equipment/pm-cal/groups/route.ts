import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { findPmCalGroupConflicts, getPmCalActor, writePmCalAudit } from '@/lib/equipment/pm-cal-server'
import { parsePmCalFiscalYear, pmCalPlanGroupReplaceSchema } from '@/lib/equipment/pm-cal-validation'
import { fiscalYearForDate, lastDayOfFiscalMonth } from '@/lib/equipment/pm-cal-domain'
import { canonicalEquipmentDepartment } from '@/lib/equipment/departments'

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

  // A plan created while its equipment was eligible can outlive that eligibility (retired, or
  // needs_calibration turned off) without being cancelled — backfill just those specific IDs (not
  // the whole equipment table, which made this query slow/unstable on ~500 rows) so the workspace
  // table shows the real name instead of a raw UUID for that row.
  const equipmentById = new Map((equipment ?? []).map(row => [row.id, row]))
  const staleEquipmentIds = [...new Set((plans ?? []).map(plan => plan.equipment_id))].filter(id => !equipmentById.has(id))
  const { data: staleEquipment, error: staleError } = staleEquipmentIds.length
    ? await supabaseAdmin.from('equipment').select('id, cbh_code, equipment_type, department, classification, needs_calibration, status').in('id', staleEquipmentIds)
    : { data: [], error: null }
  if (staleError) return NextResponse.json({ error: staleError.message }, { status: 500 })
  const allEquipment = [...(equipment ?? []), ...(staleEquipment ?? [])].map((row) => ({
    ...row,
    department: canonicalEquipmentDepartment(row.department),
  }))

  // Fetched by equipment_id, not plan_id: legacy-imported results are intentionally unlinked
  // (plan_id null) and computePmCalPlanState matches them to a plan by fiscal_year/month/cal_type
  // itself — filtering by .in('plan_id', planIds) here would exclude every unlinked result before
  // that matching ever runs, which is exactly what kept "ทำจริง" stuck at 0.
  const equipmentIds = allEquipment.map(row => row.id)
  const { data: results, error: resultError } = equipmentIds.length
    ? await supabaseAdmin.from('equipment_calibrations').select('id, plan_id, equipment_id, cal_type, completed_date, result').in('equipment_id', equipmentIds)
    : { data: [], error: null }
  if (resultError) return NextResponse.json({ error: resultError.message }, { status: 500 })
  return NextResponse.json({ fiscal_year: fiscalYear, groups: groups ?? [], equipment: allEquipment, plans: plans ?? [], results: results ?? [] })
}

export async function POST(req: NextRequest) {
  const actor = await getPmCalActor('edit')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = pmCalPlanGroupReplaceSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลแผนกลุ่มไม่ถูกต้อง', issues: parsed.error.flatten() }, { status: 422 })
  const { equipment_ids, extra_months, ...group } = parsed.data
  // extra_months lets a single create action spin off sibling groups (same equipment/plan/price) in
  // other months, for PM/CAL that legitimately recurs more than once a year. Each month is still its
  // own group row (the RPC only ever handles one month), so conflicts are checked once up front —
  // across the whole batch — before any of them are written, instead of per-month, which would
  // otherwise make month 2 look like a conflict against month 1 the instant it's saved.
  const months = [...new Set([group.calendar_month, ...(extra_months ?? [])])]
  const conflictLists = await Promise.all(months.map(calendarMonth =>
    findPmCalGroupConflicts({ equipmentIds: equipment_ids, fiscalYear: group.fiscal_year, calendarMonth, calType: group.cal_type })
  ))
  const conflicts = [...new Map(conflictLists.flat().map(item => [item.id, item])).values()]
  if (conflicts.length) return NextResponse.json({ error: group.cal_type === 'CAL' ? 'เครื่องมือบางรายการมีแผน CAL ที่ยังไม่ปิดอยู่แล้วในปีงบนี้' : 'เครื่องมือบางรายการมีแผน PM/CAL ซ้ำในเดือนนี้', conflicts }, { status: 409 })

  let result: { id: string } | null = null
  for (const calendarMonth of months) {
    // The primary month keeps the user's chosen due_date (they may deliberately pick a day other
    // than month-end) — only the extra_months siblings, which have no user-provided date, default
    // to the last day of their month.
    const due_date = calendarMonth === group.calendar_month ? group.due_date : lastDayOfFiscalMonth(group.fiscal_year, calendarMonth)
    const { data, error } = await supabaseAdmin.rpc('replace_equipment_pm_cal_plan_group', {
      p_group: { ...group, calendar_month: calendarMonth, due_date },
      p_members: equipment_ids, p_expected_versions: {}, p_actor: actor.id,
    })
    if (error) {
      const status = error.code === '40001' || error.code === '23505' ? 409 : error.code === '23503' ? 422 : 500
      return NextResponse.json({ error: error.code === '23505' ? 'เครื่องมือบางรายการมีแผน PM/CAL ซ้ำในเดือนนี้' : error.message }, { status })
    }
    result = data
    await writePmCalAudit(actor.id, 'equipment.pm_cal.group.create', String(data?.id ?? ''), `${group.plan_name} · ปีงบ ${group.fiscal_year} · เดือน ${calendarMonth} · ${equipment_ids.length} เครื่อง`)
  }
  return NextResponse.json(result, { status: 201 })
}
