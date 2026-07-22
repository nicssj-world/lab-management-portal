import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditRisk, canEditRisk, getRiskActor, getRiskPermission } from '@/lib/risk/access'
import { riskRegisterPatchSchema } from '@/lib/validations/risk-register'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRiskPermission(actor.role)) === 'none') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const registerId = Number(id)

  const [{ data, error }, { data: actions }, { data: attachments }, { data: sourceIncidents }] = await Promise.all([
    supabaseAdmin.from('risk_register').select('*').eq('id', registerId).is('deleted_at', null).single(),
    supabaseAdmin.from('risk_actions').select('*').eq('register_id', registerId)
      .order('due_date', { ascending: true, nullsFirst: false }).order('id', { ascending: true }),
    supabaseAdmin.from('risk_attachments').select('*').eq('register_id', registerId).order('uploaded_at'),
    supabaseAdmin.from('incident_reports').select('id, report_no, event_date, event_detail')
      .eq('escalated_register_id', registerId).is('deleted_at', null),
  ])

  if (error || !data) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })
  return NextResponse.json({
    data,
    actions: actions ?? [],
    attachments: attachments ?? [],
    sourceIncidents: sourceIncidents ?? [],
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canEditRisk(actor))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const parsed = riskRegisterPatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('risk_register')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', Number(id))
    .is('deleted_at', null)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })

  auditRisk('register.update', actor.id, data.risk_no ?? id, `สถานะ: ${data.status}`)
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canEditRisk(actor))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('risk_register')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', Number(id))
    .is('deleted_at', null)
    .select('risk_no')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  auditRisk('register.delete', actor.id, data?.risk_no ?? id)
  return NextResponse.json({ ok: true })
}
