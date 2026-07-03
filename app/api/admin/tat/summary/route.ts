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
type SummaryFilters = {
  lab_section: string | null
  ward: string | null
  priority: string | null
  test_name: string | null
  labzone_name: string | null
}
type TatSummaryRow = {
  id: number
  hn: string | null
  ln: string | null
  tat_minutes: number | string | null
  within_target: boolean | null
  lab_section: string | null
  ward: string | null
  priority: string | null
  test_name: string | null
  labzone_name: string | null
  is_blood_draw: boolean | null
  match_confidence: string | null
  register_at: string | null
  queue_confirmed_at: string | null
  phleb_done_at: string | null
  spcm_at: string | null
  rslt_at: string | null
  phleb_wait_minutes: number | string | null
  phleb_draw_minutes: number | string | null
  spcm_dow: number | null
  spcm_hour: number | null
}
type PhlebSummaryRow = {
  hn: string | null
  wait_minutes: number | string | null
  register_at: string | null
  labzone_name: string | null
}
type SampleMetric = {
  registerMs: number | null
  queueConfirmedMs: number | null
  phlebDoneMs: number | null
  spcmMs: number | null
  rsltMs: number | null
  labTat: number | null
  wait: number | null
  draw: number | null
  match: 'exact' | 'ambiguous' | 'no_match'
}

const summaryCache = new Map<string, { expiresAt: number; payload: SummaryPayload }>()
const TAT_SUMMARY_SELECT = [
  'id',
  'hn',
  'ln',
  'tat_minutes',
  'within_target',
  'lab_section',
  'ward',
  'priority',
  'test_name',
  'labzone_name',
  'is_blood_draw',
  'match_confidence',
  'register_at',
  'queue_confirmed_at',
  'phleb_done_at',
  'spcm_at',
  'rslt_at',
  'phleb_wait_minutes',
  'phleb_draw_minutes',
  'spcm_dow',
  'spcm_hour',
].join(',')
const PHLEB_SUMMARY_SELECT = 'hn,wait_minutes,register_at,labzone_name'
const TAT_BINS = [
  { label: '<30นาที', max: 30 },
  { label: '30-60นาที', max: 60 },
  { label: '1-2ชม.', max: 120 },
  { label: '2-4ชม.', max: 240 },
  { label: '4-8ชม.', max: 480 },
  { label: '>8ชม.', max: Infinity },
]

function hasSummaryFilter(filters: SummaryFilters) {
  return Boolean(filters.lab_section || filters.ward || filters.priority || filters.test_name || filters.labzone_name)
}

function currentMonthTrend(payload: SummaryPayload, year: number, month: number) {
  const avgTat = Number(payload.kpi?.avg_tat ?? 0)
  const pctWithinTarget = Number(payload.kpi?.pct_within_target ?? 0)
  return [{
    year,
    month,
    avg_tat: Number.isFinite(avgTat) ? avgTat : 0,
    pct_within_target: Number.isFinite(pctWithinTarget) ? pctWithinTarget : 0,
  }]
}

function cleanText(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

function toNumber(value: unknown) {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

function toMs(value: string | null) {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits))
}

function avg(values: number[], digits = 1) {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length, digits) : 0
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2)
}

function pct(numerator: number, denominator: number, digits = 1) {
  return denominator ? round((numerator * 100) / denominator, digits) : 0
}

function padHour(hour: number) {
  return String(hour).padStart(2, '0')
}

function uniqueText<T>(rows: T[], pick: (row: T) => unknown) {
  return Array.from(new Set(rows.map(row => cleanText(pick(row))).filter((value): value is string => !!value)))
    .sort((a, b) => a.localeCompare(b, 'th'))
}

function distinctCount<T>(rows: T[], pick: (row: T) => unknown) {
  return new Set(rows.map(row => cleanText(pick(row))).filter(Boolean)).size
}

function addToSetMap(map: Map<string, Set<string>>, key: string, value: unknown) {
  const normalized = cleanText(value)
  if (!normalized) return
  const set = map.get(key) ?? new Set<string>()
  set.add(normalized)
  map.set(key, set)
}

function updateSampleMatch(current: SampleMetric['match'], next: string | null) {
  if (current === 'exact' || next === 'exact') return 'exact'
  if (current === 'ambiguous' || next === 'ambiguous') return 'ambiguous'
  return 'no_match'
}

function minNumber(current: number | null, next: number | null) {
  return next == null ? current : current == null ? next : Math.min(current, next)
}

function maxNumber(current: number | null, next: number | null) {
  return next == null ? current : current == null ? next : Math.max(current, next)
}

function sampleKey(row: TatSummaryRow) {
  return cleanText(row.ln) ?? String(row.id)
}

function collectSamples(rows: TatSummaryRow[]) {
  const samples = new Map<string, SampleMetric>()

  for (const row of rows) {
    if (row.is_blood_draw !== true) continue
    const key = sampleKey(row)
    const sample = samples.get(key) ?? {
      registerMs: null,
      queueConfirmedMs: null,
      phlebDoneMs: null,
      spcmMs: null,
      rsltMs: null,
      labTat: null,
      wait: null,
      draw: null,
      match: 'no_match',
    }

    sample.registerMs = minNumber(sample.registerMs, toMs(row.register_at))
    sample.queueConfirmedMs = minNumber(sample.queueConfirmedMs, toMs(row.queue_confirmed_at))
    sample.phlebDoneMs = minNumber(sample.phlebDoneMs, toMs(row.phleb_done_at))
    sample.spcmMs = minNumber(sample.spcmMs, toMs(row.spcm_at))
    sample.rsltMs = maxNumber(sample.rsltMs, toMs(row.rslt_at))
    sample.labTat = maxNumber(sample.labTat, toNumber(row.tat_minutes))
    sample.wait = minNumber(sample.wait, toNumber(row.phleb_wait_minutes))
    sample.draw = minNumber(sample.draw, toNumber(row.phleb_draw_minutes))
    sample.match = updateSampleMatch(sample.match, row.match_confidence)
    samples.set(key, sample)
  }

  return Array.from(samples.values())
}

function sampleMatches(rows: TatSummaryRow[]) {
  const matches = new Map<string, SampleMetric['match']>()

  for (const row of rows) {
    if (row.is_blood_draw !== true) continue
    const key = sampleKey(row)
    matches.set(key, updateSampleMatch(matches.get(key) ?? 'no_match', row.match_confidence))
  }

  return Array.from(matches.values())
}

function durationFrom(startMs: number | null, endMs: number | null) {
  return startMs != null && endMs != null ? (endMs - startMs) / 60000 : null
}

function finiteValues(values: Array<number | null>) {
  return values.filter((value): value is number => value != null && Number.isFinite(value))
}

async function fetchTatSummaryRows(year: number, month: number, filters: SummaryFilters) {
  const rows: TatSummaryRow[] = []

  for (let from = 0; ; from += 1000) {
    let query = supabaseAdmin
      .from('tat_records')
      .select(TAT_SUMMARY_SELECT)
      .eq('year', year)
      .eq('month', month)
      .order('id', { ascending: true })
      .range(from, from + 999)

    if (filters.lab_section) query = query.eq('lab_section', filters.lab_section)
    if (filters.ward) query = query.eq('ward', filters.ward)
    if (filters.priority) query = query.eq('priority', filters.priority)
    if (filters.test_name) query = query.eq('test_name', filters.test_name)
    if (filters.labzone_name) query = query.eq('labzone_name', filters.labzone_name)

    const { data, error } = await query
    if (error) return { rows: null, error: error.message }
    rows.push(...((data ?? []) as unknown as TatSummaryRow[]))
    if (!data || data.length < 1000) break
  }

  return { rows, error: null }
}

async function fetchPhlebSummaryRows(year: number, month: number, labzoneName: string | null) {
  const rows: PhlebSummaryRow[] = []

  for (let from = 0; ; from += 1000) {
    let query = supabaseAdmin
      .from('phlebotomy_records')
      .select(PHLEB_SUMMARY_SELECT)
      .eq('year', year)
      .eq('month', month)
      .order('id', { ascending: true })
      .range(from, from + 999)

    if (labzoneName) query = query.eq('labzone_name', labzoneName)

    const { data, error } = await query
    if (error) return { rows: null, error: error.message }
    rows.push(...((data ?? []) as unknown as PhlebSummaryRow[]))
    if (!data || data.length < 1000) break
  }

  return { rows, error: null }
}

async function buildFilteredMonthSummary(
  year: number,
  month: number,
  filters: SummaryFilters,
  options: { includePhlebotomy: boolean },
) {
  const tatResult = await fetchTatSummaryRows(year, month, filters)
  if (tatResult.error || !tatResult.rows) return { payload: null, error: tatResult.error ?? 'Cannot load TAT rows' }

  const matchResult = filters.labzone_name
    ? await fetchTatSummaryRows(year, month, { ...filters, labzone_name: null })
    : tatResult
  if (matchResult.error || !matchResult.rows) return { payload: null, error: matchResult.error ?? 'Cannot load TAT match rows' }

  const phlebResult = options.includePhlebotomy
    ? await fetchPhlebSummaryRows(year, month, filters.labzone_name)
    : { rows: [] as PhlebSummaryRow[], error: null }
  if (phlebResult.error || !phlebResult.rows) return { payload: null, error: phlebResult.error ?? 'Cannot load phlebotomy rows' }

  const rows = tatResult.rows
  const matchRows = matchResult.rows
  const phlebRows = phlebResult.rows
  const targetRows = rows.filter(row => row.within_target !== null)
  const tatValues = finiteValues(rows.map(row => toNumber(row.tat_minutes)))
  const withinTarget = targetRows.filter(row => row.within_target === true).length
  const samples = collectSamples(rows)
  const matchedSamples = samples.filter(sample => sample.match !== 'no_match')
  const totalTat = finiteValues(matchedSamples.map(sample => durationFrom(sample.registerMs, sample.rsltMs)))
  const totalTatCut = totalTat.filter(value => value <= 720)
  const matchValues = sampleMatches(matchRows)
  const busiestHour = Array.from(rows.reduce((map, row) => {
    if (row.spcm_hour != null) map.set(row.spcm_hour, (map.get(row.spcm_hour) ?? 0) + 1)
    return map
  }, new Map<number, number>()).entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0

  const sectionGroups = new Map<string, { tatValues: number[]; lns: Set<string> }>()
  for (const row of rows) {
    const section = cleanText(row.lab_section) ?? 'ไม่ระบุ'
    const group = sectionGroups.get(section) ?? { tatValues: [], lns: new Set<string>() }
    const tat = toNumber(row.tat_minutes)
    if (tat != null) group.tatValues.push(tat)
    const ln = cleanText(row.ln)
    if (ln) group.lns.add(ln)
    sectionGroups.set(section, group)
  }

  const labzoneGroups = new Map<string, { waits: number[]; lns: Set<string> }>()
  for (const row of rows) {
    const labzone = cleanText(row.labzone_name)
    if (!labzone) continue
    const group = labzoneGroups.get(labzone) ?? { waits: [], lns: new Set<string>() }
    const ln = cleanText(row.ln)
    if (ln) group.lns.add(ln)
    const wait = row.is_blood_draw === true ? toNumber(row.phleb_wait_minutes) : null
    if (wait != null) group.waits.push(wait)
    labzoneGroups.set(labzone, group)
  }

  const phlebLabzones = new Map<string, Set<string>>()
  for (const row of phlebRows) {
    const labzone = cleanText(row.labzone_name)
    if (!labzone) continue
    const set = phlebLabzones.get(labzone) ?? new Set<string>()
    const hn = cleanText(row.hn)
    if (hn) set.add(hn)
    phlebLabzones.set(labzone, set)
  }

  const distCounts = TAT_BINS.map((bin, index) => ({
    bin: bin.label,
    count: tatValues.filter(value => index === 0
      ? value < bin.max
      : value >= TAT_BINS[index - 1].max && value < bin.max
    ).length,
  }))
  let runningDist = 0

  const heatCounts = new Map<string, number>()
  for (const row of rows) {
    if (row.spcm_dow == null || row.spcm_hour == null) continue
    const key = `${row.spcm_dow}-${row.spcm_hour}`
    heatCounts.set(key, (heatCounts.get(key) ?? 0) + 1)
  }

  const phlebHeat = new Map<string, Set<string>>()
  for (const row of phlebRows) {
    if (!row.register_at) continue
    const registerAt = new Date(row.register_at)
    if (!Number.isFinite(registerAt.getTime())) continue
    addToSetMap(phlebHeat, `${registerAt.getUTCDay()}-${registerAt.getUTCHours()}`, row.hn)
  }

  const phlebWaits = finiteValues(phlebRows.map(row => toNumber(row.wait_minutes)))
  const payload: SummaryPayload = {
    kpi: {
      total_count: rows.length,
      sample_count: distinctCount(rows, row => row.ln),
      blood_sample_count: samples.length,
      target_count: targetRows.length,
      target_coverage_pct: pct(targetRows.length, rows.length),
      avg_tat: avg(tatValues),
      median_tat: median(tatValues),
      pct_within_target: pct(withinTarget, targetRows.length),
      busiest_hour: `${padHour(busiestHour)}:00-${padHour(busiestHour + 1)}:00`,
      avg_phleb_wait: avg(phlebWaits),
      pipeline_avg_phleb_wait: avg(finiteValues(matchedSamples.map(sample => sample.wait))),
      pipeline_avg_phleb_draw: avg(finiteValues(matchedSamples.map(sample => sample.draw))),
      avg_transport: avg(finiteValues(matchedSamples.map(sample => durationFrom(sample.phlebDoneMs, sample.spcmMs)))),
      avg_total_tat: avg(totalTat),
      avg_total_tat_cut_720: avg(totalTatCut),
      median_total_tat: median(totalTat),
      median_total_tat_cut_720: median(totalTatCut),
      total_tat_cut_720_count: totalTatCut.length,
      total_tat_outlier_720_count: totalTat.length - totalTatCut.length,
      phleb_match_rate: pct(matchValues.filter(value => value !== 'no_match').length, matchValues.length),
      pct_total_within_target: pct(totalTat.filter(value => value <= 120).length, totalTat.length),
      pct_phleb_within_target: pct(phlebWaits.filter(value => value <= 30).length, phlebWaits.length, 2),
    },
    hn_null_count: rows.filter(row => !cleanText(row.hn)).length,
    has_phleb_data: phlebRows.length > 0,
    phleb_record_count: phlebRows.length,
    phleb_hn_count: distinctCount(phlebRows, row => row.hn),
    match_breakdown: {
      exact: matchValues.filter(value => value === 'exact').length,
      ambiguous: matchValues.filter(value => value === 'ambiguous').length,
      no_match: matchValues.filter(value => value === 'no_match').length,
    },
    stage_breakdown: [
      { stage: 'รอเจาะเลือด', avg_minutes: avg(finiteValues(matchedSamples.map(sample => sample.wait))) },
      { stage: 'เจาะเลือด', avg_minutes: avg(finiteValues(matchedSamples.map(sample => sample.draw))) },
      { stage: 'ขนส่งตัวอย่าง', avg_minutes: avg(finiteValues(matchedSamples.map(sample => durationFrom(sample.phlebDoneMs, sample.spcmMs)))) },
      { stage: 'วิเคราะห์ในแลป', avg_minutes: avg(finiteValues(matchedSamples.map(sample => sample.labTat))) },
    ],
    by_lab_section: Array.from(sectionGroups.entries())
      .map(([lab_section, group]) => ({ lab_section, avg_tat: avg(group.tatValues), count: group.lns.size }))
      .sort((a, b) => b.avg_tat - a.avg_tat),
    by_labzone: Array.from(labzoneGroups.entries())
      .map(([labzone_name, group]) => ({ labzone_name, count: group.lns.size, avg_wait: avg(group.waits) }))
      .sort((a, b) => b.count - a.count),
    by_labzone_phleb: Array.from(phlebLabzones.entries())
      .map(([labzone_name, set]) => ({ labzone_name, count: set.size }))
      .sort((a, b) => b.count - a.count),
    tat_distribution: distCounts.map(row => {
      runningDist += row.count
      return { ...row, cumulative_pct: pct(runningDist, tatValues.length) }
    }),
    heatmap: Array.from(heatCounts.entries()).map(([key, count]) => {
      const [dow, hour] = key.split('-').map(Number)
      return { dow, hour, count }
    }),
    phleb_heatmap: Array.from(phlebHeat.entries()).map(([key, set]) => {
      const [dow, hour] = key.split('-').map(Number)
      return { dow, hour, count: set.size }
    }),
    trend: [{ year, month, avg_tat: avg(tatValues), pct_within_target: pct(withinTarget, targetRows.length) }],
    filter_options: {
      lab_sections: uniqueText(rows, row => row.lab_section),
      wards: uniqueText(rows, row => row.ward),
      test_names: uniqueText(rows, row => row.test_name),
      labzone_names: uniqueText(rows, row => row.labzone_name),
      phleb_labzone_names: uniqueText(phlebRows, row => row.labzone_name),
    },
  }

  return { payload, error: null }
}

async function computeTotalTatCutMetrics(
  year: number,
  month: number,
  filters: SummaryFilters,
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
  filters: SummaryFilters,
) {
  if (payload.kpi?.avg_total_tat_cut_720 != null) return payload
  if (hasSummaryFilter(filters)) return payload
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
  filters: SummaryFilters,
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
  filters: SummaryFilters,
) {
  if (hasSummaryFilter(filters)) return { ...payload, trend: currentMonthTrend(payload, year, month) }
  const trend = await computeMonthlyTrend(year, month, filters)
  return trend ? { ...payload, trend } : payload
}

async function readAnalysisCacheIgnoringExpiry<T extends SummaryPayload>(endpoint: string, cacheKeyValue: string) {
  const { data, error } = await supabaseAdmin
    .from('analysis_summary_cache')
    .select('payload')
    .eq('endpoint', endpoint)
    .eq('cache_key', cacheKeyValue)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  return (data?.payload as T | undefined) ?? null
}

async function countTatRows(year: number, month: number, filters: SummaryFilters) {
  let query = supabaseAdmin
    .from('tat_records')
    .select('id', { count: 'exact', head: true })
    .eq('year', year)
    .eq('month', month)

  if (filters.lab_section) query = query.eq('lab_section', filters.lab_section)
  if (filters.ward) query = query.eq('ward', filters.ward)
  if (filters.priority) query = query.eq('priority', filters.priority)
  if (filters.test_name) query = query.eq('test_name', filters.test_name)
  if (filters.labzone_name) query = query.eq('labzone_name', filters.labzone_name)

  const { count, error } = await query
  return { count: count ?? 0, error: error?.message ?? null }
}

async function countPhlebRows(year: number, month: number, requestedLabzone: string | null) {
  let query = supabaseAdmin
    .from('phlebotomy_records')
    .select('id', { count: 'exact', head: true })
    .eq('year', year)
    .eq('month', month)

  if (requestedLabzone === CAR_BED_LABZONE) query = query.in('labzone_name', CAR_BED_SOURCE_ZONES)
  else if (requestedLabzone) query = query.eq('labzone_name', requestedLabzone)

  const { count, error } = await query
  return { count: count ?? 0, error: error?.message ?? null }
}

function summaryKeyFromFilters(year: number, month: number, filters: SummaryFilters, view?: string | null) {
  const parts = [
    'v2',
    String(year),
    String(month),
    filters.lab_section ?? '',
    filters.ward ?? '',
    filters.priority ?? '',
    filters.test_name ?? '',
    filters.labzone_name ?? '',
  ]
  if (view) parts.push(`view:${view}`)
  return parts.join('|')
}

function valueRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function valueRows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(row => row && typeof row === 'object') as Array<Record<string, unknown>> : []
}

function numberValue(value: unknown, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function payloadTotalCount(payload: SummaryPayload) {
  return numberValue(valueRecord(payload.kpi).total_count, 0)
}

function payloadHasData(payload: SummaryPayload | null | undefined): payload is SummaryPayload {
  return !!payload && (payloadTotalCount(payload) > 0 || valueRows(payload.by_lab_section).length > 0)
}

function buildLabRollupFromBase(
  base: SummaryPayload,
  year: number,
  month: number,
  filters: SummaryFilters,
  rowCount: number,
) {
  const baseKpi = valueRecord(base.kpi)
  const sectionRows = valueRows(base.by_lab_section)
  const sectionRow = filters.lab_section
    ? sectionRows.find(row => cleanText(row.lab_section) === filters.lab_section)
    : null
  const avgTat = numberValue(sectionRow?.avg_tat, numberValue(baseKpi.avg_tat))
  const effectiveCount = rowCount > 0
    ? rowCount
    : numberValue(sectionRow?.count, numberValue(baseKpi.total_count))
  const sampleCount = numberValue(sectionRow?.count, effectiveCount)

  return {
    ...base,
    precomputed: false,
    source: 'lab-rollup',
    kpi: {
      ...baseKpi,
      total_count: effectiveCount,
      sample_count: sampleCount,
      blood_sample_count: sampleCount,
      avg_tat: avgTat,
      median_tat: 0,
      pct_within_target: 0,
      target_count: 0,
      target_coverage_pct: 0,
      avg_total_tat: 0,
      median_total_tat: 0,
      avg_total_tat_cut_720: 0,
      median_total_tat_cut_720: 0,
      total_tat_cut_720_count: 0,
      total_tat_outlier_720_count: 0,
      pct_total_within_target: 0,
    },
    hn_null_count: 0,
    has_phleb_data: false,
    phleb_record_count: 0,
    phleb_hn_count: 0,
    match_breakdown: { exact: 0, ambiguous: 0, no_match: 0 },
    stage_breakdown: [],
    by_lab_section: sectionRow ? [sectionRow] : sectionRows,
    by_labzone: [],
    by_labzone_phleb: [],
    tat_distribution: [],
    heatmap: [],
    phleb_heatmap: [],
    trend: [{ year, month, avg_tat: avgTat, pct_within_target: 0 }],
  } satisfies SummaryPayload
}

function filteredSummaryFromBase(
  base: SummaryPayload,
  year: number,
  month: number,
  filters: SummaryFilters,
  rowCount: number,
) {
  const baseKpi = valueRecord(base.kpi)
  const sectionRows = valueRows(base.by_lab_section)
  const sectionRow = filters.lab_section
    ? sectionRows.find(row => cleanText(row.lab_section) === filters.lab_section)
    : null
  const avgTat = numberValue(sectionRow?.avg_tat, numberValue(baseKpi.avg_tat))
  const effectiveCount = rowCount > 0
    ? rowCount
    : numberValue(sectionRow?.count, numberValue(baseKpi.total_count))

  return {
    ...base,
    precomputed: false,
    source: 'filtered-rollup',
    kpi: {
      ...baseKpi,
      total_count: effectiveCount,
      sample_count: numberValue(sectionRow?.count, effectiveCount),
      avg_tat: avgTat,
    },
    by_lab_section: sectionRow ? [sectionRow] : sectionRows,
    by_labzone: filters.labzone_name
      ? valueRows(base.by_labzone).filter(row => cleanText(row.labzone_name) === filters.labzone_name)
      : valueRows(base.by_labzone),
    trend: [{ year, month, avg_tat: avgTat, pct_within_target: numberValue(baseKpi.pct_within_target) }],
  } satisfies SummaryPayload
}

async function readBaseSummary(year: number, month: number) {
  const baseKey = summaryKeyFromFilters(year, month, {
    lab_section: null,
    ward: null,
    priority: null,
    test_name: null,
    labzone_name: null,
  })

  return await readAnalysisCache<SummaryPayload>(CACHE_ENDPOINT, baseKey)
    ?? await readAnalysisCacheIgnoringExpiry<SummaryPayload>(CACHE_ENDPOINT, baseKey)
}

async function buildPhlebotomyOnlySummary(year: number, month: number, requestedLabzone: string | null) {
  const rows: PhlebSummaryRow[] = []
  const sourceZones = requestedLabzone === CAR_BED_LABZONE ? CAR_BED_SOURCE_ZONES : null

  for (let from = 0; ; from += 1000) {
    let query = supabaseAdmin
      .from('phlebotomy_records')
      .select(PHLEB_SUMMARY_SELECT)
      .eq('year', year)
      .eq('month', month)
      .order('id', { ascending: true })
      .range(from, from + 999)

    if (sourceZones) query = query.in('labzone_name', sourceZones)
    else if (requestedLabzone) query = query.eq('labzone_name', requestedLabzone)

    const { data, error } = await query
    if (error) return { payload: null, error: error.message }
    rows.push(...((data ?? []) as unknown as PhlebSummaryRow[]))
    if (!data || data.length < 1000) break
  }

  const waits = finiteValues(rows.map(row => toNumber(row.wait_minutes)))
  const hnCount = distinctCount(rows, row => row.hn)
  const labzoneCounts = new Map<string, Set<string>>()
  const heat = new Map<string, Set<string>>()

  for (const row of rows) {
    const rawLabzone = cleanText(row.labzone_name)
    if (rawLabzone) {
      const labzone = CAR_BED_SOURCE_ZONES.includes(rawLabzone) ? CAR_BED_LABZONE : rawLabzone
      const set = labzoneCounts.get(labzone) ?? new Set<string>()
      const hn = cleanText(row.hn)
      if (hn) set.add(hn)
      labzoneCounts.set(labzone, set)
    }

    if (row.register_at) {
      const d = new Date(row.register_at)
      if (Number.isFinite(d.getTime())) addToSetMap(heat, `${d.getUTCDay()}-${d.getUTCHours()}`, row.hn)
    }
  }

  const base = await readBaseSummary(year, month)
  const payload: SummaryPayload = {
    ...(base ?? {}),
    precomputed: false,
    source: 'phlebotomy-filter',
    kpi: {
      ...valueRecord(base?.kpi),
      total_count: 0,
      sample_count: 0,
      avg_phleb_wait: avg(waits),
      pct_phleb_within_target: pct(waits.filter(value => value <= 30).length, waits.length, 2),
    },
    has_phleb_data: rows.length > 0,
    phleb_record_count: rows.length,
    phleb_hn_count: hnCount,
    by_labzone_phleb: Array.from(labzoneCounts.entries())
      .map(([labzone_name, set]) => ({ labzone_name, count: set.size }))
      .sort((a, b) => b.count - a.count),
    phleb_heatmap: Array.from(heat.entries()).map(([key, set]) => {
      const [dow, hour] = key.split('-').map(Number)
      return { dow, hour, count: set.size }
    }),
    filter_options: base?.filter_options ?? {
      lab_sections: [],
      wards: [],
      test_names: [],
      labzone_names: [],
      phleb_labzone_names: uniqueText(rows, row => row.labzone_name),
    },
  }

  return { payload, error: null }
}

function buildPhlebotomyRollupFromBase(
  base: SummaryPayload,
  requestedLabzone: string | null,
  rowCount: number,
) {
  const baseKpi = valueRecord(base.kpi)
  const sourceRows = valueRows(base.by_labzone_phleb)
  const hnCount = requestedLabzone === CAR_BED_LABZONE
    ? sourceRows
        .filter(row => CAR_BED_SOURCE_ZONES.includes(String(row.labzone_name ?? '')))
        .reduce((sum, row) => sum + numberValue(row.count), 0)
    : numberValue(sourceRows.find(row => cleanText(row.labzone_name) === requestedLabzone)?.count, rowCount)
  const byLabzone = requestedLabzone
    ? [{ labzone_name: requestedLabzone, count: hnCount }]
    : sourceRows
  const effectiveRowCount = rowCount > 0
    ? rowCount
    : requestedLabzone
      ? hnCount
      : numberValue(base.phleb_record_count)

  return {
    ...base,
    precomputed: false,
    source: 'phlebotomy-rollup',
    kpi: {
      ...baseKpi,
      total_count: 0,
      sample_count: 0,
    },
    has_phleb_data: effectiveRowCount > 0,
    phleb_record_count: effectiveRowCount,
    phleb_hn_count: hnCount,
    by_labzone_phleb: byLabzone,
    phleb_heatmap: requestedLabzone ? [] : base.phleb_heatmap,
  } satisfies SummaryPayload
}

function cacheKey(sp: URLSearchParams) {
  const parts = [
    'v2',
    sp.get('year') ?? '',
    sp.get('month') ?? '',
    sp.get('lab_section') ?? '',
    sp.get('ward') ?? '',
    sp.get('priority') ?? '',
    sp.get('test_name') ?? '',
    sp.get('labzone_name') ?? '',
  ]
  const view = sp.get('view')
  if (view) parts.push(`view2:${view}`)
  return parts.join('|')
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
  const requestedLabzone = sp.get('labzone_name') || null
  const labzoneForRpc = requestedLabzone === CAR_BED_LABZONE ? null : requestedLabzone
  const requestedFilters = requestFilters(sp)
  const rpcFilters = requestFilters(sp, labzoneForRpc)
  const view = sp.get('view') || 'overview'

  const key = cacheKey(sp)
  const cached = summaryCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.payload.precomputed === true) {
      return NextResponse.json(cached.payload, {
        headers: { 'X-TAT-Summary-Cache': 'precomputed-memory' },
      })
    }
    const enriched = await enrichWithCutMetrics(cached.payload, year, month, requestedFilters)
    const withTrend = await enrichWithFilteredTrend(enriched, year, month, requestedFilters)
    if (withTrend !== cached.payload) {
      summaryCache.set(key, { expiresAt: cached.expiresAt, payload: withTrend })
    }
    return NextResponse.json(withTrend, {
      headers: { 'X-TAT-Summary-Cache': 'hit' },
    })
  }

  const persistent = await readAnalysisCache<SummaryPayload>(CACHE_ENDPOINT, key)
  if (persistent) {
    if (!payloadHasData(persistent)) {
      if (view === 'phlebotomy' && requestedLabzone) {
        const basePayload = await readBaseSummary(year, month)
        if (payloadHasData(basePayload)) {
          const rollup = buildPhlebotomyRollupFromBase(basePayload, requestedLabzone, 0)
          summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: rollup })
          await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, rollup, PERSISTENT_CACHE_TTL_MS)
          return NextResponse.json(rollup, {
            headers: { 'X-TAT-Summary-Cache': 'phlebotomy-cache-recovered' },
          })
        }
      }
      const noViewKey = summaryKeyFromFilters(year, month, requestedFilters)
      if (key !== noViewKey) {
        const recovered = await readAnalysisCache<SummaryPayload>(CACHE_ENDPOINT, noViewKey)
          ?? await readAnalysisCacheIgnoringExpiry<SummaryPayload>(CACHE_ENDPOINT, noViewKey)
        if (payloadHasData(recovered)) {
          summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: recovered })
          await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, recovered, PERSISTENT_CACHE_TTL_MS)
          return NextResponse.json(recovered, {
            headers: { 'X-TAT-Summary-Cache': 'view-cache-recovered' },
          })
        }
      }
    }
    if (persistent.precomputed === true) {
      summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: persistent })
      return NextResponse.json(persistent, {
        headers: { 'X-TAT-Summary-Cache': 'precomputed' },
      })
    }
    const enriched = await enrichWithCutMetrics(persistent, year, month, requestedFilters)
    const withTrend = await enrichWithFilteredTrend(enriched, year, month, requestedFilters)
    summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: withTrend })
    if (withTrend !== persistent) await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, withTrend, PERSISTENT_CACHE_TTL_MS)
    return NextResponse.json(withTrend, {
      headers: { 'X-TAT-Summary-Cache': 'persistent' },
    })
  }

  if (view === 'overview' && !hasSummaryFilter(requestedFilters)) {
    const basePayload = await readBaseSummary(year, month)
    if (basePayload) {
      summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: basePayload })
      return NextResponse.json(basePayload, {
        headers: { 'X-TAT-Summary-Cache': 'overview-base' },
      })
    }
  }

  if (view === 'phlebotomy') {
    if (!requestedLabzone) {
      const basePayload = await readBaseSummary(year, month)
      if (basePayload) {
        summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: basePayload })
        return NextResponse.json(basePayload, {
          headers: { 'X-TAT-Summary-Cache': 'phlebotomy-base' },
        })
      }
    }

    if (requestedLabzone) {
      const rowCountResult = await countPhlebRows(year, month, requestedLabzone)
      if (rowCountResult.error) return NextResponse.json({ error: rowCountResult.error }, { status: 500 })
      const basePayload = await readBaseSummary(year, month)
      if (basePayload) {
        const rollup = buildPhlebotomyRollupFromBase(basePayload, requestedLabzone, rowCountResult.count)
        summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: rollup })
        await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, rollup, PERSISTENT_CACHE_TTL_MS)
        return NextResponse.json(rollup, {
          headers: { 'X-TAT-Summary-Cache': 'phlebotomy-rollup' },
        })
      }
    }

    const { payload, error } = await buildPhlebotomyOnlySummary(year, month, requestedLabzone)
    if (error || !payload) return NextResponse.json({ error: error ?? 'Cannot build phlebotomy summary' }, { status: 500 })
    summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload })
    await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, payload, PERSISTENT_CACHE_TTL_MS)
    return NextResponse.json(payload, {
      headers: { 'X-TAT-Summary-Cache': 'phlebotomy-filter' },
    })
  }

  if (view === 'lab' && requestedLabzone !== CAR_BED_LABZONE) {
    const noViewKey = summaryKeyFromFilters(year, month, requestedFilters)
    const rowCountResult = await countTatRows(year, month, rpcFilters)
    if (rowCountResult.error) return NextResponse.json({ error: rowCountResult.error }, { status: 500 })
    const basePayloadForLab = await readBaseSummary(year, month)

    if (rowCountResult.count === 0 && payloadHasData(basePayloadForLab)) {
      const rollup = buildLabRollupFromBase(basePayloadForLab, year, month, requestedFilters, rowCountResult.count)
      summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: rollup })
      await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, rollup, PERSISTENT_CACHE_TTL_MS)
      return NextResponse.json(rollup, {
        headers: { 'X-TAT-Summary-Cache': 'lab-base-rollup' },
      })
    }

    const exactFresh = await readAnalysisCache<SummaryPayload>(CACHE_ENDPOINT, noViewKey)
    if (exactFresh && payloadTotalCount(exactFresh) === rowCountResult.count) {
      const withTrend = await enrichWithFilteredTrend(exactFresh, year, month, requestedFilters)
      summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: withTrend })
      return NextResponse.json(withTrend, {
        headers: { 'X-TAT-Summary-Cache': 'lab-alias' },
      })
    }

    const exactStale = await readAnalysisCacheIgnoringExpiry<SummaryPayload>(CACHE_ENDPOINT, noViewKey)
    if (exactStale && payloadTotalCount(exactStale) === rowCountResult.count) {
      const withTrend = await enrichWithFilteredTrend(exactStale, year, month, requestedFilters)
      summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: withTrend })
      await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, withTrend, PERSISTENT_CACHE_TTL_MS)
      return NextResponse.json(withTrend, {
        headers: { 'X-TAT-Summary-Cache': 'lab-stale-alias' },
      })
    }

    if (rowCountResult.count > 5000) {
      if (basePayloadForLab) {
        const rollup = buildLabRollupFromBase(basePayloadForLab, year, month, requestedFilters, rowCountResult.count)
        summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: rollup })
        await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, rollup, PERSISTENT_CACHE_TTL_MS)
        return NextResponse.json(rollup, {
          headers: { 'X-TAT-Summary-Cache': 'lab-rollup' },
        })
      }
    }

    const { payload, error } = await buildFilteredMonthSummary(year, month, rpcFilters, {
      includePhlebotomy: false,
    })
    if (error || !payload) return NextResponse.json({ error: error ?? 'Cannot build filtered TAT summary' }, { status: 500 })
    const withTrend = await enrichWithFilteredTrend(payload, year, month, requestedFilters)
    summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: withTrend })
    await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, withTrend, PERSISTENT_CACHE_TTL_MS)
    return NextResponse.json(withTrend, {
      headers: { 'X-TAT-Summary-Cache': 'lab-filtered-month' },
    })
  }

  if (hasSummaryFilter(requestedFilters) && requestedLabzone !== CAR_BED_LABZONE) {
    const noViewKey = summaryKeyFromFilters(year, month, requestedFilters)
    const rowCountResult = await countTatRows(year, month, rpcFilters)
    if (rowCountResult.error) return NextResponse.json({ error: rowCountResult.error }, { status: 500 })
    const basePayloadForFilter = await readBaseSummary(year, month)

    if (rowCountResult.count === 0 && payloadHasData(basePayloadForFilter)) {
      const rollup = filteredSummaryFromBase(basePayloadForFilter, year, month, requestedFilters, rowCountResult.count)
      summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: rollup })
      await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, rollup, PERSISTENT_CACHE_TTL_MS)
      return NextResponse.json(rollup, {
        headers: { 'X-TAT-Summary-Cache': 'filtered-base-rollup' },
      })
    }

    const exactFresh = await readAnalysisCache<SummaryPayload>(CACHE_ENDPOINT, noViewKey)
    if (exactFresh && payloadTotalCount(exactFresh) === rowCountResult.count) {
      const withTrend = await enrichWithFilteredTrend(exactFresh, year, month, requestedFilters)
      summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: withTrend })
      return NextResponse.json(withTrend, {
        headers: { 'X-TAT-Summary-Cache': 'filtered-alias' },
      })
    }

    const exactStale = await readAnalysisCacheIgnoringExpiry<SummaryPayload>(CACHE_ENDPOINT, noViewKey)
    if (exactStale && payloadTotalCount(exactStale) === rowCountResult.count) {
      const withTrend = await enrichWithFilteredTrend(exactStale, year, month, requestedFilters)
      summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: withTrend })
      await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, withTrend, PERSISTENT_CACHE_TTL_MS)
      return NextResponse.json(withTrend, {
        headers: { 'X-TAT-Summary-Cache': 'filtered-stale-alias' },
      })
    }

    if (rowCountResult.count > 5000) {
      if (basePayloadForFilter) {
        const rollup = filteredSummaryFromBase(basePayloadForFilter, year, month, requestedFilters, rowCountResult.count)
        summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: rollup })
        await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, rollup, PERSISTENT_CACHE_TTL_MS)
        return NextResponse.json(rollup, {
          headers: { 'X-TAT-Summary-Cache': 'filtered-rollup' },
        })
      }
    }

    const { payload, error } = await buildFilteredMonthSummary(year, month, rpcFilters, {
      includePhlebotomy: Boolean(rpcFilters.labzone_name),
    })
    if (error || !payload) return NextResponse.json({ error: error ?? 'Cannot build filtered TAT summary' }, { status: 500 })
    const withTrend = await enrichWithFilteredTrend(payload, year, month, requestedFilters)
    summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: withTrend })
    await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, withTrend, PERSISTENT_CACHE_TTL_MS)
    return NextResponse.json(withTrend, {
      headers: { 'X-TAT-Summary-Cache': 'filtered-month' },
    })
  }

  // All unfiltered aggregation runs server-side in PostgreSQL — no PostgREST row-limit issue

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
    }, year, month, rpcFilters)
    const withTrend = await enrichWithFilteredTrend(payload, year, month, rpcFilters)
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
  }, year, month, rpcFilters)
  const withTrend = await enrichWithFilteredTrend(payload, year, month, rpcFilters)

  summaryCache.set(key, { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, payload: withTrend })
  await writeAnalysisCache(CACHE_ENDPOINT, key, year, month, withTrend, PERSISTENT_CACHE_TTL_MS)
  return NextResponse.json(withTrend, {
    headers: { 'X-TAT-Summary-Cache': 'miss' },
  })
}
