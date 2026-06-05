import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canEditRisk, getRiskActor, getRiskPermission, normalizeRiskPayload } from '@/lib/risk-server'

const PAGE_SIZE = 1000
const ACTION_ID_CHUNK_SIZE = 300

const riskSchema = z.object({
  risk_no: z.string().nullable().optional(),
  external_no: z.string().nullable().optional(),
  event_type: z.string().nullable().optional(),
  event_date: z.string().nullable().optional(),
  event_time: z.string().nullable().optional(),
  reporter_name: z.string().nullable().optional(),
  reporter_position: z.string().nullable().optional(),
  department_found: z.string().nullable().optional(),
  department_target: z.string().nullable().optional(),
  risk_type: z.string().nullable().optional(),
  event_main_category: z.string().nullable().optional(),
  event_sub_category: z.string().nullable().optional(),
  event_category: z.string().nullable().optional(),
  event_detail: z.string().nullable().optional(),
  impact_summary: z.string().nullable().optional(),
  immediate_correction: z.string().nullable().optional(),
  evidence_note: z.string().nullable().optional(),
  severity_level: z.string().nullable().optional(),
  ior_status: z.string().nullable().optional(),
  recorded_date: z.string().nullable().optional(),
  likelihood: z.number().nullable().optional(),
  impact: z.number().nullable().optional(),
  owner: z.string().nullable().optional(),
  status: z.enum(['open', 'mitigating', 'monitoring', 'closed']).optional(),
  review_status: z.enum(['pending', 'reviewed', 'rca_required', 'action_plan', 'follow_up', 'closed']).optional(),
  review_note: z.string().nullable().optional(),
  rca_method: z.string().nullable().optional(),
  root_cause: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  follow_up_date: z.string().nullable().optional(),
  effectiveness_result: z.string().nullable().optional(),
})

async function fetchAllRisks(sp: URLSearchParams) {
  const rows: unknown[] = []
  const status = sp.get('status')
  const severity = sp.get('severity')
  const department = sp.get('department')
  const year = sp.get('year')
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    let query = supabaseAdmin
      .from('risks')
      .select('*')
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (severity) query = query.eq('severity_level', severity)
    if (department) query = query.eq('department_found', department)
    if (year && /^\d{4}$/.test(year)) {
      query = query.gte('event_date', `${year}-01-01`).lte('event_date', `${year}-12-31`)
    }

    const { data, error } = await query.range(from, to)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

async function fetchAllRiskActions(riskIds: number[]) {
  const actions: unknown[] = []
  for (let i = 0; i < riskIds.length; i += ACTION_ID_CHUNK_SIZE) {
    const ids = riskIds.slice(i, i + ACTION_ID_CHUNK_SIZE)
    for (let from = 0; ; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1
      const { data, error } = await supabaseAdmin
        .from('risk_actions')
        .select('*')
        .in('risk_id', ids)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .range(from, to)
      if (error) throw error
      actions.push(...(data ?? []))
      if (!data || data.length < PAGE_SIZE) break
    }
  }
  return actions
}

export async function GET(req: NextRequest) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perm = await getRiskPermission(actor.role)
  if (perm === 'none') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  try {
    const data = await fetchAllRisks(sp)
    const ids = data.map(row => Number((row as { id: unknown }).id)).filter(Number.isFinite)
    const actions = ids.length > 0 ? await fetchAllRiskActions(ids) : []
    return NextResponse.json({ data, actions })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await canEditRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const ids: number[] = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isFinite) : []
  if (ids.length === 0) return NextResponse.json({ error: 'ไม่มี id ที่ระบุ' }, { status: 422 })

  const { error } = await supabaseAdmin.from('risks').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, deleted: ids.length })
}

export async function POST(req: NextRequest) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await canEditRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = riskSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 })

  const payload = normalizeRiskPayload({
    ...parsed.data,
    created_by: actor.id,
  })

  const { data, error } = await supabaseAdmin
    .from('risks')
    .insert(payload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
