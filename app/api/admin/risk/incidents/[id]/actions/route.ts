import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditRisk, canReviewRisk, getRiskActor } from '@/lib/risk/access'
import { syncIncidentStatus } from '@/lib/risk/incident'
import { incidentActionPatchSchema, incidentActionSchema } from '@/lib/validations/incident'

type Params = { params: Promise<{ id: string }> }

async function ensureOpen(incidentId: number) {
  const { data } = await supabaseAdmin
    .from('incident_reports')
    .select('status, report_no')
    .eq('id', incidentId)
    .is('deleted_at', null)
    .single()
  if (!data) return { error: NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 }) }
  if (data.status === 'closed') {
    return { error: NextResponse.json({ error: 'เรื่องที่ปิดแล้วแก้มาตรการไม่ได้' }, { status: 409 }) }
  }
  return { incident: data }
}

export async function POST(req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReviewRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const incidentId = Number(id)
  const guard = await ensureOpen(incidentId)
  if (guard.error) return guard.error

  const parsed = incidentActionSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('risk_actions')
    .insert({ ...parsed.data, incident_id: incidentId, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await syncIncidentStatus(incidentId)
  auditRisk('incident.action.create', actor.id, guard.incident.report_no ?? id, parsed.data.description.slice(0, 120))
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReviewRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const incidentId = Number(id)
  const guard = await ensureOpen(incidentId)
  if (guard.error) return guard.error

  const parsed = incidentActionPatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }
  const { id: actionId, ...patch } = parsed.data

  const { data, error } = await supabaseAdmin
    .from('risk_actions')
    .update({
      ...patch,
      // ปิดมาตรการแล้วบันทึกเวลาให้อัตโนมัติ ผู้ใช้ไม่ต้องกรอกเอง
      ...(patch.status === 'done' ? { completed_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', actionId)
    .eq('incident_id', incidentId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await syncIncidentStatus(incidentId)
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReviewRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const incidentId = Number(id)
  const guard = await ensureOpen(incidentId)
  if (guard.error) return guard.error

  const actionId = Number(req.nextUrl.searchParams.get('actionId'))
  if (!actionId) return NextResponse.json({ error: 'ไม่ได้ระบุมาตรการที่ต้องการลบ' }, { status: 422 })

  const { error } = await supabaseAdmin
    .from('risk_actions')
    .delete()
    .eq('id', actionId)
    .eq('incident_id', incidentId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await syncIncidentStatus(incidentId)
  return NextResponse.json({ ok: true })
}
