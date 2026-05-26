import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { readAnalysisCache, writeAnalysisCache } from '@/lib/analysis-cache'
import { NextRequest, NextResponse } from 'next/server'

const CAR_BED_LABZONE = 'ช่องรถนั่ง-นอน'
const CAR_BED_SOURCE_ZONES = ['ช่อง 10', 'ช่อง 11']
const SUMMARY_CACHE_TTL_MS = 2 * 60 * 1000
const PERSISTENT_CACHE_TTL_MS = 12 * 60 * 60 * 1000
const CACHE_ENDPOINT = 'tat-summary'

type SummaryPayload = Record<string, unknown> & {
  kpi?: Record<string, unknown>
}
type SummaryData = SummaryPayload & {
  by_labzone_phleb?: Array<{ count?: number }>
  has_phleb_data?: boolean
  phleb_record_count?: number
  phleb_hn_count?: number
}

const summaryCache = new Map<string, { expiresAt: number; payload: SummaryPayload }>()

function cacheKey(sp: URLSearchParams) {
  return [
    'v2',
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

  const persistent = await readAnalysisCache<SummaryPayload>(CACHE_ENDPOINT, key)
  if (persistent) {
    summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: persistent })
    return NextResponse.json(persistent, {
      headers: { 'X-TAT-Summary-Cache': 'persistent' },
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

  const responseData = data as SummaryData

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
    const pctPhlebWithinTarget = waits.length
      ? Number(((waits.filter(value => value <= 30).length * 100) / waits.length).toFixed(2))
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
      has_phleb_data:     rows.length > 0,
      phleb_record_count: rows.length,
      phleb_hn_count:     hnCount,
      by_labzone_phleb:   [{ labzone_name: CAR_BED_LABZONE, count: hnCount }],
      phleb_heatmap:      Array.from(heat.entries()).map(([key, count]) => {
        const [dow, hour] = key.split('-').map(Number)
        return { dow, hour, count }
      }),
    }
    summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload })
    await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, payload, PERSISTENT_CACHE_TTL_MS)
    return NextResponse.json(payload, {
      headers: { 'X-TAT-Summary-Cache': 'miss' },
    })
  }

  const payload: SummaryPayload = {
    ...responseData,
    has_phleb_data: responseData.has_phleb_data ?? (
      responseData.by_labzone_phleb?.some(row => (row.count ?? 0) > 0) ?? false
    ),
    phleb_record_count: responseData.phleb_record_count ?? 0,
    phleb_hn_count: responseData.phleb_hn_count ?? (
      responseData.by_labzone_phleb?.reduce((sum, row) => sum + (row.count ?? 0), 0) ?? 0
    ),
    kpi: responseData.kpi,
  }

  summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload })
  await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, payload, PERSISTENT_CACHE_TTL_MS)
  return NextResponse.json(payload, {
    headers: { 'X-TAT-Summary-Cache': 'miss' },
  })
}
