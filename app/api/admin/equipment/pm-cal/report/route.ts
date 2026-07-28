import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPmCalActor } from '@/lib/equipment/pm-cal-server'
import { fiscalYearForDate } from '@/lib/equipment/pm-cal-domain'
import { buildPmCalReport, type PmCalReportEquipment, type PmCalReportGroup, type PmCalReportPlan, type PmCalReportResult } from '@/lib/equipment/pm-cal-report'
import { fetchAllPages } from '@/lib/equipment-map/pagination'
import { parsePmCalFiscalYear } from '@/lib/equipment/pm-cal-validation'

export async function GET(req: NextRequest) {
  const actor = await getPmCalActor('read')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const fiscalYear = parsePmCalFiscalYear(req.nextUrl.searchParams.get('fiscalYear'), fiscalYearForDate(new Date()))
  if (fiscalYear == null) return NextResponse.json({ error: 'ปีงบประมาณไม่ถูกต้อง' }, { status: 422 })
  const department = req.nextUrl.searchParams.get('department')?.trim() ?? ''
  const classification = req.nextUrl.searchParams.get('classification')?.trim() ?? ''

  const [equipment, allPlans, allResults, allGroups] = await Promise.all([
    fetchAllPages(async (from, to) => {
      let query = supabaseAdmin.from('equipment').select('id, equipment_type, department, classification').range(from, to)
      if (department) query = query.eq('department', department)
      if (classification) query = query.eq('classification', classification)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return data ?? []
    }),
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabaseAdmin.from('equipment_pm_cal_plans')
        .select('id, equipment_id, fiscal_year, calendar_month, cal_type, due_date, record_status, version, planned_cost, plan_group_id')
        .eq('fiscal_year', fiscalYear).eq('record_status', 'active').range(from, to)
      if (error) throw new Error(error.message)
      return data ?? []
    }),
    fetchAllPages(async (from, to) => {
      // Legacy-imported results are intentionally unlinked (plan_id null) but computePmCalPlanState
      // still matches them to a plan by equipment_id/fiscal_year/calendar_month/cal_type — excluding
      // them here left completed legacy calibrations reporting as overdue.
      const { data, error } = await supabaseAdmin.from('equipment_calibrations')
        .select('id, plan_id, equipment_id, cal_type, completed_date, result, actual_cost')
        .range(from, to)
      if (error) throw new Error(error.message)
      return data ?? []
    }),
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabaseAdmin.from('equipment_pm_cal_plan_groups')
        .select('id, planned_amount, actual_amount, record_status').eq('fiscal_year', fiscalYear).eq('record_status', 'active').range(from, to)
      if (error) throw new Error(error.message)
      return data ?? []
    }),
  ]).catch(error => { throw error })

  const equipmentIds = new Set(equipment.map(item => item.id as string))
  const plans = (allPlans as unknown as PmCalReportPlan[]).filter(plan => equipmentIds.has(plan.equipment_id))
  // Scoped by equipment_id, not plan_id: unlinked legacy results have no plan_id to match against,
  // and computePmCalPlanState's own equipment_id guard is what keeps this from crossing equipment.
  const results = (allResults as unknown as PmCalReportResult[]).filter(result => equipmentIds.has(result.equipment_id))
  const report = buildPmCalReport({ equipment: equipment as unknown as PmCalReportEquipment[], plans, results, groups: allGroups as unknown as PmCalReportGroup[] })
  return NextResponse.json({ fiscal_year: fiscalYear, filters: { department, classification }, ...report })
}
