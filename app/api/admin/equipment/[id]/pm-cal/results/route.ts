import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPmCalActor, writePmCalAudit } from '@/lib/equipment/pm-cal-server'
import { fiscalYearForDate } from '@/lib/equipment/pm-cal-domain'
import { pmCalResultCreateSchema } from '@/lib/equipment/pm-cal-validation'

interface Params { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const actor = await getPmCalActor('edit')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const parsed = pmCalResultCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลผล PM/CAL ไม่ถูกต้อง', issues: parsed.error.flatten() }, { status: 422 })

  const { data: plan, error: planError } = await supabaseAdmin.from('equipment_pm_cal_plans').select('id, equipment_id, cal_type').eq('id', parsed.data.plan_id).eq('equipment_id', id).eq('record_status', 'active').maybeSingle()
  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 })
  if (!plan) return NextResponse.json({ error: 'ไม่พบแผน PM/CAL ของเครื่องมือนี้' }, { status: 404 })
  if (plan.cal_type !== parsed.data.cal_type) return NextResponse.json({ error: 'ประเภทผลไม่ตรงกับแผน' }, { status: 422 })

  const completed = new Date(`${parsed.data.completed_date}T00:00:00`)
  const { remark, ...input } = parsed.data
  const { data, error } = await supabaseAdmin.from('equipment_calibrations').insert({
    ...input,
    equipment_id: id,
    fiscal_year: fiscalYearForDate(completed),
    calendar_month: completed.getMonth() + 1,
    planned: true,
    notes: remark ?? null,
    source: 'manual',
    created_by: actor.id,
    updated_by: actor.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writePmCalAudit(actor.id, 'equipment.pm_cal.result.create', id, `${parsed.data.cal_type} · ${parsed.data.completed_date} · ${parsed.data.result ?? 'COMPLETED'}`)
  return NextResponse.json(data, { status: 201 })
}
