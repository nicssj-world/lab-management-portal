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

async function computeTotalTatCutMetrics(
  year: number,
  month: number,
  filters: {
    lab_section: string | null
    ward: string | null
    priority: string | null
    test_name: string | null
    labzone_name: string | null
  },
) {
  const rows: Array<{
    id: number
    ln: string | null
    register_at: string | null
    rslt_at: string | null
    match_confidence: string | null
  }> = []

  for (let from = 0; ; from += 1000) {
    let query = supabaseAdmin
      .from('tat_records')
      .select('id,ln,register_at,rslt_at,match_confidence')
      .eq('year', year)
      .eq('month', month)
      .eq('is_blood_draw', true)
      .range(from, from + 999)

    if (filters.lab_section) query = query.eq('lab_section', filters.lab_section)
    if (filters.ward) query = query.eq('ward', filters.ward)
    if (filters.priority) query = query.eq('priority', filters.priority)
    if (filters.test_name) query = query.eq('test_name', filters.test_name)
    if (filters.labzone_name) query = query.eq('labzone_name', filters.labzone_name)

    const { data, error } = await query
    if (error) return null
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const samples = new Map<string, { registerMs: number | null; rsltMs: number | null; matched: boolean }>()
  for (const row of rows) {
    const sampleKey = row.ln?.trim() || String(row.id)
    const sample = samples.get(sampleKey) ?? { registerMs: null, rsltMs: null, matched: false }
    if (row.register_at) {
      const registerMs = new Date(row.register_at).getTime()
      if (Number.isFinite(registerMs) && (sample.registerMs == null || registerMs < sample.registerMs)) {
        sample.registerMs = registerMs
      }
    }
    if (row.rslt_at) {
      const rsltMs = new Date(row.rslt_at).getTime()
      if (Number.isFinite(rsltMs) && (sample.rsltMs == null || rsltMs > sample.rsltMs)) {
        sample.rsltMs = rsltMs
      }
    }
    if (row.match_confidence && row.match_confidence !== 'no_match') sample.matched = true
    samples.set(sampleKey, sample)
  }

  const values = Array.from(samples.values())
    .filter(sample => sample.matched && sample.registerMs != null && sample.rsltMs != null)
    .map(sample => ((sample.rsltMs as number) - (sample.registerMs as number)) / 60000)
    .filter(value => Number.isFinite(value) && value >= 0)

  const cut = values.filter(value => value <= 720)
  const avg = cut.length ? cut.reduce((sum, value) => sum + value, 0) / cut.length : 0
  const sorted = [...cut].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length
    ? sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
    : 0

  return {
    avg_total_tat_cut_720: Number(avg.toFixed(1)),
    median_total_tat_cut_720: Number(median.toFixed(1)),
    total_tat_cut_720_count: cut.length,
    total_tat_outlier_720_count: values.length - cut.length,
  }
}

async function enrichWithCutMetrics(
  payload: SummaryPayload,
  year: number,
  month: number,
  filters: {
    lab_section: string | null
    ward: string | null
    priority: string | null
    test_name: string | null
    labzone_name: string | null
  },
) {
  if (payload.kpi?.avg_total_tat_cut_720 != null) return payload
  const cutMetrics = await computeTotalTatCutMetrics(year, month, filters)
  if (!cutMetrics) return payload
  return {
    ...payload,
    kpi: {
      ...payload.kpi,
      ...cutMetrics,
    },
  }
}

async function computeMonthlyTrend(
  year: number,
  month: number,
  filters: {
    lab_section: string | null
    ward: string | null
    priority: string | null
    test_name: string | null
    labzone_name: string | null
  },
) {
  const months = Array.from({ length: 12 }, (_, index) => {
    const d = new Date(year, month - 1 - (11 - index), 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })

  const trend = []
  for (const ym of months) {
    const rows: Array<{ tat_minutes: number | null; within_target: boolean | null }> = []
    for (let from = 0; ; from += 1000) {
      let query = supabaseAdmin
        .from('tat_records')
        .select('tat_minutes,within_target')
        .eq('year', ym.year)
        .eq('month', ym.month)
        .range(from, from + 999)

      if (filters.lab_section) query = query.eq('lab_section', filters.lab_section)
      if (filters.ward) query = query.eq('ward', filters.ward)
      if (filters.priority) query = query.eq('priority', filters.priority)
      if (filters.test_name) query = query.eq('test_name', filters.test_name)
      if (filters.labzone_name) query = query.eq('labzone_name', filters.labzone_name)

      const { data, error } = await query
      if (error) return null
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    const tatValues = rows
      .map(row => typeof row.tat_minutes === 'number' ? row.tat_minutes : Number(row.tat_minutes))
      .filter(Number.isFinite)
    const targetRows = rows.filter(row => row.within_target != null)
    const within = targetRows.filter(row => row.within_target === true).length

    trend.push({
      year: ym.year,
      month: ym.month,
      avg_tat: tatValues.length
        ? Number((tatValues.reduce((sum, value) => sum + value, 0) / tatValues.length).toFixed(1))
        : 0,
      pct_within_target: targetRows.length
        ? Number(((within * 100) / targetRows.length).toFixed(1))
        : 0,
    })
  }
  return trend
}

async function enrichWithFilteredTrend(
  payload: SummaryPayload,
  year: number,
  month: number,
  filters: {
    lab_section: string | null
    ward: string | null
    priority: string | null
    test_name: string | null
    labzone_name: string | null
  },
) {
  const trend = await computeMonthlyTrend(year, month, filters)
  return trend ? { ...payload, trend } : payload
}

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

function requestFilters(sp: URLSearchParams, labzoneForRpc?: string | null) {
  return {
    lab_section: sp.get('lab_section') || null,
    ward:        sp.get('ward') || null,
    priority:    sp.get('priority') || null,
    test_name:   sp.get('test_name') || null,
    labzone_name: labzoneForRpc !== undefined ? labzoneForRpc : (sp.get('labzone_name') || null),
  }
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
    const enriched = await enrichWithCutMetrics(cached.payload, year, month, {
      ...requestFilters(sp),
    })
    const withTrend = await enrichWithFilteredTrend(enriched, year, month, requestFilters(sp))
    if (withTrend !== cached.payload) {
      summaryCache.set(key, { expiresAt: cached.expiresAt, payload: withTrend })
    }
    return NextResponse.json(withTrend, {
      headers: { 'X-TAT-Summary-Cache': 'hit' },
    })
  }

  const persistent = await readAnalysisCache<SummaryPayload>(CACHE_ENDPOINT, key)
  if (persistent) {
    const enriched = await enrichWithCutMetrics(persistent, year, month, requestFilters(sp))
    const withTrend = await enrichWithFilteredTrend(enriched, year, month, requestFilters(sp))
    summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: withTrend })
    if (withTrend !== persistent) await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, withTrend, PERSISTENT_CACHE_TTL_MS)
    return NextResponse.json(withTrend, {
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

    const payload: SummaryPayload = await enrichWithCutMetrics({
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
    }, year, month, requestFilters(sp, labzoneForRpc))
    const withTrend = await enrichWithFilteredTrend(payload, year, month, requestFilters(sp, labzoneForRpc))
    summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: withTrend })
    await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, withTrend, PERSISTENT_CACHE_TTL_MS)
    return NextResponse.json(withTrend, {
      headers: { 'X-TAT-Summary-Cache': 'miss' },
    })
  }

  const payload: SummaryPayload = await enrichWithCutMetrics({
    ...responseData,
    has_phleb_data: responseData.has_phleb_data ?? (
      responseData.by_labzone_phleb?.some(row => (row.count ?? 0) > 0) ?? false
    ),
    phleb_record_count: responseData.phleb_record_count ?? 0,
    phleb_hn_count: responseData.phleb_hn_count ?? (
      responseData.by_labzone_phleb?.reduce((sum, row) => sum + (row.count ?? 0), 0) ?? 0
    ),
    kpi: responseData.kpi,
  }, year, month, requestFilters(sp, labzoneForRpc))
  const withTrend = await enrichWithFilteredTrend(payload, year, month, requestFilters(sp, labzoneForRpc))

  summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: withTrend })
  await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, withTrend, PERSISTENT_CACHE_TTL_MS)
  return NextResponse.json(withTrend, {
    headers: { 'X-TAT-Summary-Cache': 'miss' },
  })
}
