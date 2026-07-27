import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fiscalYearForDate } from '@/lib/equipment/pm-cal-domain'
import { getPmCalActor, writePmCalAudit } from '@/lib/equipment/pm-cal-server'
import { parsePmCalFiscalYear, pmCalPlanReplaceSchema } from '@/lib/equipment/pm-cal-validation'

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const actor = await getPmCalActor('read')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const fiscalYear = parsePmCalFiscalYear(req.nextUrl.searchParams.get('fiscalYear'), fiscalYearForDate(new Date()))
  if (fiscalYear == null) return NextResponse.json({ error: 'ปีงบประมาณไม่ถูกต้อง' }, { status: 422 })

  const { data: equipment, error: equipmentError } = await supabaseAdmin
    .from('equipment').select('id, cbh_code, equipment_type, needs_calibration, pm_cal_data').eq('id', id).maybeSingle()
  if (equipmentError) return NextResponse.json({ error: equipmentError.message }, { status: 500 })
  if (!equipment) return NextResponse.json({ error: 'ไม่พบเครื่องมือ' }, { status: 404 })

  const [{ data: plans, error: plansError }, { data: results, error: resultsError }] = await Promise.all([
    supabaseAdmin.from('equipment_pm_cal_plans').select('*').eq('equipment_id', id).eq('fiscal_year', fiscalYear).eq('record_status', 'active').order('calendar_month').order('cal_type'),
    supabaseAdmin.from('equipment_calibrations').select('*').eq('equipment_id', id).order('completed_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
  ])
  if (plansError || resultsError) return NextResponse.json({ error: plansError?.message ?? resultsError?.message }, { status: 500 })
  return NextResponse.json({ equipment, fiscal_year: fiscalYear, plans: plans ?? [], results: results ?? [], legacy: equipment.pm_cal_data })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const actor = await getPmCalActor('edit')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const parsed = pmCalPlanReplaceSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลแผนไม่ถูกต้อง', issues: parsed.error.flatten() }, { status: 422 })

  const { data: equipment } = await supabaseAdmin.from('equipment').select('id, cbh_code').eq('id', id).maybeSingle()
  if (!equipment) return NextResponse.json({ error: 'ไม่พบเครื่องมือ' }, { status: 404 })
  const { data, error } = await supabaseAdmin.rpc('replace_equipment_pm_cal_plans', {
    p_equipment_id: id,
    p_fiscal_year: parsed.data.fiscal_year,
    p_plans: parsed.data.plans,
    p_expected_versions: parsed.data.expected_versions,
    p_actor: actor.id,
  })
  if (error) {
    const conflict = error.code === '40001' || error.code === '23505'
    return NextResponse.json({ error: conflict ? 'แผนถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดใหม่' : error.message }, { status: conflict ? 409 : 500 })
  }
  await writePmCalAudit(actor.id, 'equipment.pm_cal.plan.replace', equipment.cbh_code ?? id, `ปีงบ ${parsed.data.fiscal_year} · ${parsed.data.plans.length} รอบ`)
  return NextResponse.json({ plans: data ?? [] })
}
