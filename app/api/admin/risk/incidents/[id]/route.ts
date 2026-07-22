import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditRisk, canEditRisk, canReviewRisk, getRiskActor, getRiskPermission, stripReviewOnlyFields } from '@/lib/risk/access'
import { incidentPatchSchema } from '@/lib/validations/incident'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRiskPermission(actor.role)) === 'none') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const incidentId = Number(id)

  const [{ data, error }, { data: actions }, { data: attachments }] = await Promise.all([
    supabaseAdmin.from('incident_reports').select('*').eq('id', incidentId).is('deleted_at', null).single(),
    supabaseAdmin.from('risk_actions').select('*').eq('incident_id', incidentId)
      .order('due_date', { ascending: true, nullsFirst: false }).order('id', { ascending: true }),
    supabaseAdmin.from('risk_attachments').select('*').eq('incident_id', incidentId).order('uploaded_at'),
  ])

  if (error || !data) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })
  return NextResponse.json({ data, actions: actions ?? [], attachments: attachments ?? [] })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // แก้ไขข้อมูลใช้ permission matrix ไม่ใช่การผูกกับตำแหน่งแบบเดิม
  if (!(await canEditRisk(actor))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const parsed = incidentPatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const { data: current } = await supabaseAdmin
    .from('incident_reports')
    .select('status, report_no')
    .eq('id', Number(id))
    .is('deleted_at', null)
    .single()

  if (!current) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })
  if (current.status === 'closed') {
    return NextResponse.json({ error: 'เรื่องที่ปิดแล้วแก้ไขไม่ได้ ต้องเปิดเรื่องใหม่ก่อน' }, { status: 409 })
  }

  const { payload, warnings } = stripReviewOnlyFields(parsed.data, canReviewRisk(actor))
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: warnings[0] ?? 'ไม่มีข้อมูลที่ต้องบันทึก' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('incident_reports')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', Number(id))
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  auditRisk('incident.update', actor.id, data.report_no ?? id, `สถานะ: ${data.status}`)
  return NextResponse.json({ data, warnings })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canEditRisk(actor))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('incident_reports')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', Number(id))
    .is('deleted_at', null)
    .select('report_no')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  auditRisk('incident.delete', actor.id, data?.report_no ?? id)
  return NextResponse.json({ ok: true })
}
