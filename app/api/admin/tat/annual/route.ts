import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const CACHE_ENDPOINT = 'tat-summary'
const CACHE_VERSION = 'v2'

type Kpi = Record<string, number | string | null | undefined>
type MonthlyPayload = {
  kpi?: Kpi
  by_lab_section?: Array<{ lab_section: string; avg_tat: number; count: number }>
  by_labzone?: Array<{ labzone_name: string; count: number; avg_wait: number }>
  by_labzone_phleb?: Array<{ labzone_name: string; count: number }>
  tat_distribution?: Array<{ bin: string; count: number; cumulative_pct: number }>
}

function toGregorianFiscalYear(year: number) {
  return year > 2400 ? year - 543 : year
}

function fiscalMonths(fiscalYear: number) {
  return [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(month => ({
    year: month >= 10 ? fiscalYear - 1 : fiscalYear,
    month,
  }))
}

function cacheKey(year: number, month: number) {
  return [CACHE_VERSION, String(year), String(month), '', '', '', '', ''].join('|')
}

function num(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function weightedAvg(sum: number, weight: number) {
  return weight > 0 ? Number((sum / weight).toFixed(1)) : 0
}

async function readMonthlyPayload(year: number, month: number) {
  const { data, error } = await supabaseAdmin
    .from('analysis_summary_cache')
    .select('payload')
    .eq('endpoint', CACHE_ENDPOINT)
    .eq('cache_key', cacheKey(year, month))
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error) return null
  return (data?.payload as MonthlyPayload | undefined) ?? null
}

function addWeighted(map: Map<string, { count: number; weighted: number }>, key: string, count: number, value: number) {
  const row = map.get(key) ?? { count: 0, weighted: 0 }
  row.count += count
  row.weighted += value * count
  map.set(key, row)
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const displayFiscalYear = Number(req.nextUrl.searchParams.get('year'))
  if (!displayFiscalYear) return NextResponse.json({ error: 'year required' }, { status: 422 })

  const fiscalYear = toGregorianFiscalYear(displayFiscalYear)
  const months = fiscalMonths(fiscalYear)
  const payloads = await Promise.all(months.map(ym => readMonthlyPayload(ym.year, ym.month)))

  let totalCount = 0
  let sampleCount = 0
  let targetCount = 0
  let withinTarget = 0
  let avgTatWeighted = 0
  let avgTotalTatWeighted = 0
  let totalTatWeight = 0
  let phlebWaitWeighted = 0
  let phlebWaitWeight = 0
  let matchRateWeighted = 0
  let matchRateWeight = 0
  let cutCount = 0
  let outlierCount = 0

  const sections = new Map<string, { count: number; weighted: number }>()
  const labzones = new Map<string, { count: number; weighted: number }>()
  const phlebZones = new Map<string, number>()
  const bins = new Map<string, number>()

  const monthRows = months.map((ym, index) => {
    const payload = payloads[index]
    const kpi = payload?.kpi ?? {}
    const monthTotal = num(kpi.total_count)
    const monthSamples = num(kpi.sample_count)
    const monthTarget = num(kpi.target_count)
    const monthWithin = num(kpi.pct_within_target) * monthTarget / 100
    const monthTotalTatWeight = num(kpi.total_tat_cut_720_count) + num(kpi.total_tat_outlier_720_count)
    const monthPhlebWeight = num(payload?.by_labzone_phleb?.reduce((sum, row) => sum + num(row.count), 0))
    const monthMatchWeight = num(kpi.blood_sample_count)

    totalCount += monthTotal
    sampleCount += monthSamples
    targetCount += monthTarget
    withinTarget += monthWithin
    avgTatWeighted += num(kpi.avg_tat) * monthTotal
    avgTotalTatWeighted += num(kpi.avg_total_tat_cut_720 ?? kpi.avg_total_tat) * monthTotalTatWeight
    totalTatWeight += monthTotalTatWeight
    phlebWaitWeighted += num(kpi.avg_phleb_wait) * monthPhlebWeight
    phlebWaitWeight += monthPhlebWeight
    matchRateWeighted += num(kpi.phleb_match_rate) * monthMatchWeight
    matchRateWeight += monthMatchWeight
    cutCount += num(kpi.total_tat_cut_720_count)
    outlierCount += num(kpi.total_tat_outlier_720_count)

    for (const row of payload?.by_lab_section ?? []) {
      addWeighted(sections, row.lab_section, num(row.count), num(row.avg_tat))
    }
    for (const row of payload?.by_labzone ?? []) {
      addWeighted(labzones, row.labzone_name, num(row.count), num(row.avg_wait))
    }
    for (const row of payload?.by_labzone_phleb ?? []) {
      phlebZones.set(row.labzone_name, (phlebZones.get(row.labzone_name) ?? 0) + num(row.count))
    }
    for (const row of payload?.tat_distribution ?? []) {
      bins.set(row.bin, (bins.get(row.bin) ?? 0) + num(row.count))
    }

    return {
      year: ym.year,
      month: ym.month,
      has_data: !!payload,
      total_count: monthTotal,
      sample_count: monthSamples,
      avg_tat: num(kpi.avg_tat),
      pct_within_target: num(kpi.pct_within_target),
      avg_total_tat: num(kpi.avg_total_tat_cut_720 ?? kpi.avg_total_tat),
      phleb_match_rate: num(kpi.phleb_match_rate),
    }
  })

  let running = 0
  const distributionTotal = Array.from(bins.values()).reduce((sum, value) => sum + value, 0)
  const distribution = Array.from(bins.entries()).map(([bin, count]) => {
    running += count
    return {
      bin,
      count,
      cumulative_pct: distributionTotal > 0 ? Number(((running * 100) / distributionTotal).toFixed(1)) : 0,
    }
  })

  return NextResponse.json({
    fiscal_year: displayFiscalYear,
    selected_year: fiscalYear,
    months: monthRows,
    kpi: {
      total_count: totalCount,
      sample_count: sampleCount,
      avg_tat: weightedAvg(avgTatWeighted, totalCount),
      pct_within_target: targetCount > 0 ? Number(((withinTarget * 100) / targetCount).toFixed(1)) : 0,
      avg_total_tat: weightedAvg(avgTotalTatWeighted, totalTatWeight),
      avg_phleb_wait: weightedAvg(phlebWaitWeighted, phlebWaitWeight),
      phleb_match_rate: weightedAvg(matchRateWeighted, matchRateWeight),
      total_tat_cut_720_count: cutCount,
      total_tat_outlier_720_count: outlierCount,
      data_months: payloads.filter(Boolean).length,
    },
    by_lab_section: Array.from(sections.entries())
      .map(([lab_section, row]) => ({ lab_section, count: row.count, avg_tat: weightedAvg(row.weighted, row.count) }))
      .sort((a, b) => b.count - a.count),
    by_labzone: Array.from(labzones.entries())
      .map(([labzone_name, row]) => ({ labzone_name, count: row.count, avg_wait: weightedAvg(row.weighted, row.count) }))
      .sort((a, b) => b.count - a.count),
    by_labzone_phleb: Array.from(phlebZones.entries())
      .map(([labzone_name, count]) => ({ labzone_name, count }))
      .sort((a, b) => b.count - a.count),
    tat_distribution: distribution,
  })
}
