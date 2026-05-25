import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const CAR_BED_LABZONE = 'ช่องรถนั่ง-นอน'
const CAR_BED_SOURCE_ZONES = ['ช่อง 10', 'ช่อง 11']
const SUMMARY_CACHE_TTL_MS = 2 * 60 * 1000

type SummaryPayload = Record<string, unknown> & {
  kpi?: Record<string, unknown>
}

const summaryCache = new Map<string, { expiresAt: number; payload: SummaryPayload }>()

function cacheKey(sp: URLSearchParams) {
  return [
    sp.get('year') ?? '',
    sp.get('month') ?? '',
    sp.get('lab_section') ?? '',
    sp.get('ward') ?? '',
    sp.get('priority') ?? '',
    sp.get('test_name') ?? '',
    sp.get('labzone_name') ?? '',
  ].join('|')
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const year = Number(sp.get('year'))
  const month = Number(sp.get('month'))
  if (!year || !month)
    return NextResponse.json({ error: 'year and month required' }, { status: 422 })

  const key = cacheKey(sp)
  const cached = summaryCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: { 'X-TAT-Summary-Cache': 'hit' },
    })
  }

  // All aggregation runs server-side in PostgreSQL — no PostgREST row-limit issue
  const requestedLabzone = sp.get('labzone_name') || null
  const labzoneForRpc = requestedLabzone === CAR_BED_LABZONE ? null : requestedLabzone

  const { data, error } = await supabaseAdmin.rpc('get_tat_summary', {
    p_year:        year,
    p_month:       month,
    p_lab_section: sp.get('lab_section') || null,
    p_ward:        sp.get('ward')        || null,
    p_priority:    sp.get('priority')    || null,
    p_test_name:   sp.get('test_name')   || null,
    p_labzone:     labzoneForRpc,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const isCarBedFilter = requestedLabzone === CAR_BED_LABZONE

  let phlebUploadQuery = supabaseAdmin
    .from('phleb_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('year', year)
    .eq('month', month)

  let phlebRecordQuery = supabaseAdmin
    .from('phlebotomy_records')
    .select('id', { count: 'exact', head: true })
    .eq('year', year)
    .eq('month', month)
  if (isCarBedFilter) phlebRecordQuery = phlebRecordQuery.in('labzone_name', CAR_BED_SOURCE_ZONES)

  const labzone = requestedLabzone

  const phlebKpiPromise = isCarBedFilter
    ? Promise.resolve({ data: null, error: null })
    : supabaseAdmin.rpc('get_phleb_kpi', {
        p_year:    year,
        p_month:   month,
        p_labzone: labzone,
      })

  let phlebWaitBaseQuery = supabaseAdmin
    .from('phlebotomy_records')
    .select('id', { count: 'exact', head: true })
    .eq('year', year)
    .eq('month', month)
    .not('wait_minutes', 'is', null)
  if (isCarBedFilter) phlebWaitBaseQuery = phlebWaitBaseQuery.in('labzone_name', CAR_BED_SOURCE_ZONES)
  else if (labzone) phlebWaitBaseQuery = phlebWaitBaseQuery.eq('labzone_name', labzone)

  let phlebWithinQuery = supabaseAdmin
    .from('phlebotomy_records')
    .select('id', { count: 'exact', head: true })
    .eq('year', year)
    .eq('month', month)
    .not('wait_minutes', 'is', null)
    .lte('wait_minutes', 30)
  if (isCarBedFilter) phlebWithinQuery = phlebWithinQuery.in('labzone_name', CAR_BED_SOURCE_ZONES)
  else if (labzone) phlebWithinQuery = phlebWithinQuery.eq('labzone_name', labzone)
  const [
    { count: phlebCount },
    { count: phlebRecordCount },
    { data: phlebKpi },
    { count: phlebWaitCount },
    { count: phlebWithinCount },
  ] = await Promise.all([
    phlebUploadQuery,
    phlebRecordQuery,
    phlebKpiPromise,
    phlebWaitBaseQuery,
    phlebWithinQuery,
  ])

  const pctPhlebWithinTarget = phlebWaitCount
    ? Number((((phlebWithinCount ?? 0) * 100) / phlebWaitCount).toFixed(2))
    : 0
  const responseData = data as { kpi?: Record<string, unknown> }

  if (isCarBedFilter) {
    const { data: phlebRows, error: phlebRowsError } = await supabaseAdmin
      .from('phlebotomy_records')
      .select('hn,wait_minutes,register_at,labzone_name')
      .eq('year', year)
      .eq('month', month)
      .in('labzone_name', CAR_BED_SOURCE_ZONES)

    if (phlebRowsError) return NextResponse.json({ error: phlebRowsError.message }, { status: 500 })

    const rows = phlebRows ?? []
    const hnCount = new Set(rows.map(r => String(r.hn ?? '').trim()).filter(Boolean)).size
    const waits = rows
      .map(r => typeof r.wait_minutes === 'number' ? r.wait_minutes : Number(r.wait_minutes))
      .filter(Number.isFinite)
    const avgWait = waits.length
      ? Number((waits.reduce((sum, value) => sum + value, 0) / waits.length).toFixed(1))
      : 0
    const heat = new Map<string, number>()
    for (const row of rows) {
      if (!row.register_at) continue
      const d = new Date(row.register_at)
      const key = `${d.getUTCDay()}-${d.getUTCHours()}`
      heat.set(key, (heat.get(key) ?? 0) + 1)
    }

    const payload: SummaryPayload = {
      ...data,
      kpi: responseData.kpi
        ? {
            ...responseData.kpi,
            avg_phleb_wait: avgWait,
            pct_phleb_within_target: pctPhlebWithinTarget,
          }
        : responseData.kpi,
      has_phleb_data:     (phlebCount ?? 0) > 0,
      phleb_record_count: rows.length,
      phleb_hn_count:     hnCount,
      by_labzone_phleb:   [{ labzone_name: CAR_BED_LABZONE, count: hnCount }],
      phleb_heatmap:      Array.from(heat.entries()).map(([key, count]) => {
        const [dow, hour] = key.split('-').map(Number)
        return { dow, hour, count }
      }),
    }
    summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload })
    return NextResponse.json(payload, {
      headers: { 'X-TAT-Summary-Cache': 'miss' },
    })
  }

  const payload: SummaryPayload = {
    ...data,
    kpi: responseData.kpi
      ? { ...responseData.kpi, pct_phleb_within_target: pctPhlebWithinTarget }
      : responseData.kpi,
    has_phleb_data:     (phlebCount ?? 0) > 0,
    phleb_record_count: phlebRecordCount ?? 0,
    phleb_hn_count:     (phlebKpi as { phleb_hn_count: number } | null)?.phleb_hn_count ?? 0,
  }

  summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload })
  return NextResponse.json(payload, {
    headers: { 'X-TAT-Summary-Cache': 'miss' },
  })
}
