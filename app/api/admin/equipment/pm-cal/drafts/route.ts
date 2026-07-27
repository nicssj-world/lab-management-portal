import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPmCalActor } from '@/lib/equipment/pm-cal-server'
import { buildPlanGroupDrafts, type PlanGroup } from '@/lib/equipment/pm-cal-groups'
import { parsePmCalFiscalYear } from '@/lib/equipment/pm-cal-validation'

export async function GET(req: NextRequest) {
  const actor = await getPmCalActor('read')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const targetFiscalYear = parsePmCalFiscalYear(req.nextUrl.searchParams.get('targetFiscalYear'), 0)
  const source = req.nextUrl.searchParams.get('source')
  if (targetFiscalYear == null || targetFiscalYear < 2500 || targetFiscalYear > 3000 || !['legacy_template', 'fiscal_year'].includes(source ?? '')) {
    return NextResponse.json({ error: 'แหล่งข้อมูลหรือปีงบประมาณไม่ถูกต้อง' }, { status: 422 })
  }
  if (source === 'legacy_template') return NextResponse.json({ drafts: buildPlanGroupDrafts('legacy_template', targetFiscalYear) })
  const sourceFiscalYear = parsePmCalFiscalYear(req.nextUrl.searchParams.get('sourceFiscalYear'), 0)
  if (sourceFiscalYear == null || sourceFiscalYear < 2500 || sourceFiscalYear > 3000 || sourceFiscalYear === targetFiscalYear) return NextResponse.json({ error: 'ปีงบต้นทางไม่ถูกต้อง' }, { status: 422 })
  const { data, error } = await supabaseAdmin.from('equipment_pm_cal_plan_groups').select('*').eq('fiscal_year', sourceFiscalYear).eq('record_status', 'active').order('group_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ drafts: buildPlanGroupDrafts('fiscal_year', targetFiscalYear, (data ?? []) as PlanGroup[]) })
}
