import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canEditRisk, getRiskActor, getRiskPermission, normalizeRiskPayload } from '@/lib/risk-server'

const FETCH_CHUNK_SIZE = 1000
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const ACTION_ID_CHUNK_SIZE = 300

const DASHBOARD_SELECT = [
  'id',
  'risk_no',
  'external_no',
  'event_type',
  'event_date',
  'recorded_date',
  'created_at',
  'name',
  'department_found',
  'department_target',
  'risk_type',
  'event_main_category',
  'event_sub_category',
  'event_category',
  'severity_level',
  'ior_status',
  'likelihood',
  'impact',
  'level',
  'status',
  'requires_rca',
  'root_cause',
  'due_date',
  'follow_up_date',
  'residual_likelihood',
  'residual_impact',
  'residual_score',
  'residual_level',
  'owner',
].join(',')

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

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function fiscalYearRange(value: string | null) {
  if (!value) return null
  const displayYear = Number(value)
  if (!Number.isInteger(displayYear)) return null
  const fiscalYear = displayYear > 2400 ? displayYear - 543 : displayYear
  return {
    fiscalYear,
    start: `${fiscalYear - 1}-10-01`,
    end: `${fiscalYear}-09-30`,
  }
}

function monthDateRange(range: ReturnType<typeof fiscalYearRange>, monthValue: string | null) {
  if (!range || !monthValue || !/^\d{2}$/.test(monthValue)) return null
  const month = Number(monthValue)
  if (month < 1 || month > 12) return null
  const year = month >= 10 ? range.fiscalYear - 1 : range.fiscalYear
  const lastDay = new Date(year, month, 0).getDate()
  return {
    start: `${year}-${monthValue}-01`,
    end: `${year}-${monthValue}-${String(lastDay).padStart(2, '0')}`,
  }
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

function applyRiskFilters(query: any, sp: URLSearchParams) {
  const scope = sp.get('scope') ?? sp.get('tab') ?? 'all'
  const status = sp.get('status')
  const severity = sp.get('severity')
  const department = sp.get('department')
  const month = sp.get('month')
  const q = (sp.get('q') ?? sp.get('query') ?? '').trim()
  const range = fiscalYearRange(sp.get('year'))

  if (scope === 'smart') {
    query = query.not('external_no', 'is', null).neq('external_no', '')
  } else if (scope === 'register') {
    query = query.or('external_no.is.null,external_no.eq.').eq('event_type', 'risk_assessment')
  } else if (scope === 'ior') {
    query = query.or('external_no.is.null,external_no.eq.').or('event_type.is.null,event_type.neq.risk_assessment')
  }

  if (status) query = query.eq('status', status)
  if (severity) query = query.eq('severity_level', severity)
  if (department) query = query.eq('department_found', department)
  const monthRange = monthDateRange(range, month)
  if (monthRange) query = query.gte('event_date', monthRange.start).lte('event_date', monthRange.end)
  else if (range) query = query.gte('event_date', range.start).lte('event_date', range.end)
  if (q) {
    const pattern = `%${escapeLike(q)}%`
    query = query.or([
      `risk_no.ilike.${pattern}`,
      `external_no.ilike.${pattern}`,
      `name.ilike.${pattern}`,
      `event_detail.ilike.${pattern}`,
      `department_found.ilike.${pattern}`,
      `department_target.ilike.${pattern}`,
      `event_main_category.ilike.${pattern}`,
      `event_sub_category.ilike.${pattern}`,
    ].join(','))
  }

  return query
}

async function fetchDashboardRisks() {
  const rows: unknown[] = []
  for (let from = 0; ; from += FETCH_CHUNK_SIZE) {
    const to = from + FETCH_CHUNK_SIZE - 1
    let query = supabaseAdmin
      .from('risks')
      .select(DASHBOARD_SELECT)
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    const { data, error } = await query.range(from, to)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < FETCH_CHUNK_SIZE) break
  }
  return rows
}

async function fetchAllRiskActions(riskIds: number[]) {
  const actions: unknown[] = []
  for (let i = 0; i < riskIds.length; i += ACTION_ID_CHUNK_SIZE) {
    const ids = riskIds.slice(i, i + ACTION_ID_CHUNK_SIZE)
    for (let from = 0; ; from += FETCH_CHUNK_SIZE) {
      const to = from + FETCH_CHUNK_SIZE - 1
      const { data, error } = await supabaseAdmin
        .from('risk_actions')
        .select('*')
        .in('risk_id', ids)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .range(from, to)
      if (error) throw error
      actions.push(...(data ?? []))
      if (!data || data.length < FETCH_CHUNK_SIZE) break
    }
  }
  return actions
}

async function fetchPagedRisks(sp: URLSearchParams) {
  const page = parsePositiveInt(sp.get('page'), 1)
  const pageSize = clamp(parsePositiveInt(sp.get('pageSize'), DEFAULT_PAGE_SIZE), 1, MAX_PAGE_SIZE)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  let query = supabaseAdmin
    .from('risks')
    .select('*', { count: 'exact' })
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  query = applyRiskFilters(query, sp)

  const { data, error, count } = await query.range(from, to)
  if (error) throw error
  const ids = (data ?? []).map(row => Number((row as { id: unknown }).id)).filter(Number.isFinite)
  const actions = ids.length > 0 ? await fetchAllRiskActions(ids) : []

  return {
    data: data ?? [],
    actions,
    count: count ?? 0,
    page,
    pageSize,
  }
}

export async function GET(req: NextRequest) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perm = await getRiskPermission(actor.role)
  if (perm === 'none') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  try {
    if (sp.get('view') === 'list') {
      return NextResponse.json(await fetchPagedRisks(sp))
    }

    const data = await fetchDashboardRisks()
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
