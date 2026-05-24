import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

interface TatRecord {
  tat_minutes: number | null
  target_minutes: number | null
  within_target: boolean | null
  lab_section: string | null
  ward: string | null
  priority: string | null
  test_name: string | null
  spcm_hour: number | null
  spcm_dow: number | null
  phleb_wait_minutes: number | null
  transport_minutes: number | null
  total_tat_minutes: number | null
  is_blood_draw: boolean | null
  match_confidence: string | null
  labzone_name: string | null
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
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

  const lab_section = sp.get('lab_section') || null
  const ward = sp.get('ward') || null
  const priority = sp.get('priority') || null
  const test_name = sp.get('test_name') || null
  const labzone_name = sp.get('labzone_name') || null

  // Main data for selected month (includes phlebotomy join fields)
  let q = supabaseAdmin
    .from('tat_records')
    .select([
      'tat_minutes', 'target_minutes', 'within_target',
      'lab_section', 'ward', 'priority', 'test_name',
      'spcm_hour', 'spcm_dow',
      'phleb_wait_minutes', 'transport_minutes', 'total_tat_minutes',
      'is_blood_draw', 'match_confidence', 'labzone_name',
    ].join(', '))
    .eq('year', year)
    .eq('month', month)

  if (lab_section) q = q.eq('lab_section', lab_section)
  if (ward) q = q.eq('ward', ward)
  if (priority) q = q.eq('priority', priority)
  if (test_name) q = q.eq('test_name', test_name)
  if (labzone_name) q = q.eq('labzone_name', labzone_name)

  const { data: rows, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const data = (rows ?? []) as unknown as TatRecord[]

  // ===== Core TAT KPI =====
  const total_count = data.length
  const avg_tat =
    total_count > 0
      ? Math.round((data.reduce((s, r) => s + (r.tat_minutes ?? 0), 0) / total_count) * 10) / 10
      : 0

  const sorted = data.map(r => r.tat_minutes ?? 0).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median_tat =
    sorted.length === 0
      ? 0
      : sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]

  const withTarget = data.filter(r => r.within_target !== null)
  const pct_within_target =
    withTarget.length > 0
      ? Math.round((withTarget.filter(r => r.within_target).length / withTarget.length) * 1000) / 10
      : 0

  const hourCounts = new Array(24).fill(0)
  for (const r of data) {
    if (r.spcm_hour != null) hourCounts[r.spcm_hour]++
  }
  const maxHour = hourCounts.indexOf(Math.max(...hourCounts))
  const busiest_hour = `${String(maxHour).padStart(2, '0')}:00–${String(maxHour + 1).padStart(2, '0')}:00`

  // ===== Phlebotomy KPI =====
  // phleb_wait + total_tat: blood draw rows that matched successfully
  const bloodMatched = data.filter(
    r => r.is_blood_draw && r.match_confidence && r.match_confidence !== 'no_match'
      && r.phleb_wait_minutes != null
  )
  const avg_phleb_wait =
    bloodMatched.length > 0
      ? Math.round((bloodMatched.reduce((s, r) => s + (r.phleb_wait_minutes ?? 0), 0) / bloodMatched.length) * 10) / 10
      : 0

  const totalTatVals = data
    .filter(r => r.is_blood_draw && r.match_confidence && r.match_confidence !== 'no_match' && r.total_tat_minutes != null)
    .map(r => r.total_tat_minutes as number)
  const avg_total_tat = totalTatVals.length > 0
    ? Math.round((totalTatVals.reduce((s, v) => s + v, 0) / totalTatVals.length) * 10) / 10
    : 0
  const median_total_tat = Math.round(median(totalTatVals) * 10) / 10

  // transport: any row that matched (regardless of tube type)
  const transportMatched = data.filter(
    r => r.match_confidence && r.match_confidence !== 'no_match' && r.transport_minutes != null
  )
  const avg_transport =
    transportMatched.length > 0
      ? Math.round((transportMatched.reduce((s, r) => s + (r.transport_minutes ?? 0), 0) / transportMatched.length) * 10) / 10
      : 0

  // Match rate — % of total rows that are NOT 'no_match'
  const matchedCount = data.filter(r => r.match_confidence && r.match_confidence !== 'no_match').length
  const phleb_match_rate =
    total_count > 0 ? Math.round((matchedCount / total_count) * 1000) / 10 : 0

  // ===== Match breakdown =====
  const matchCounts = { exact: 0, ambiguous: 0, no_match: 0 }
  for (const r of data) {
    const mc = r.match_confidence
    if (mc === 'exact') matchCounts.exact++
    else if (mc === 'ambiguous') matchCounts.ambiguous++
    else matchCounts.no_match++
  }

  // ===== Stage breakdown (blood+matched only, for fair comparison) =====
  const stage_breakdown = [
    { stage: 'รอเจาะเลือด', avg_minutes: avg_phleb_wait },
    { stage: 'ขนส่งตัวอย่าง', avg_minutes: avg_transport },
    { stage: 'วิเคราะห์ในแลป', avg_minutes: avg_tat },
  ]

  // ===== By lab section =====
  const sectionMap = new Map<string, { sum: number; count: number }>()
  for (const r of data) {
    const key = r.lab_section || 'ไม่ระบุ'
    const g = sectionMap.get(key) ?? { sum: 0, count: 0 }
    g.sum += r.tat_minutes ?? 0
    g.count++
    sectionMap.set(key, g)
  }
  const by_lab_section = Array.from(sectionMap.entries())
    .map(([ls, g]) => ({
      lab_section: ls,
      avg_tat: g.count > 0 ? Math.round((g.sum / g.count) * 10) / 10 : 0,
      count: g.count,
    }))
    .sort((a, b) => b.avg_tat - a.avg_tat)

  // ===== By labzone =====
  const labzoneMap = new Map<string, { waitSum: number; waitCount: number; count: number }>()
  for (const r of data) {
    if (!r.labzone_name) continue
    const g = labzoneMap.get(r.labzone_name) ?? { waitSum: 0, waitCount: 0, count: 0 }
    g.count++
    if (r.is_blood_draw && r.phleb_wait_minutes != null) {
      g.waitSum += r.phleb_wait_minutes
      g.waitCount++
    }
    labzoneMap.set(r.labzone_name, g)
  }
  const by_labzone = Array.from(labzoneMap.entries())
    .map(([lz, g]) => ({
      labzone_name: lz,
      count: g.count,
      avg_wait: g.waitCount > 0 ? Math.round((g.waitSum / g.waitCount) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // ===== Distribution =====
  const binLabels = ['<30นาที', '30–60นาที', '1–2ชม.', '2–4ชม.', '4–8ชม.', '>8ชม.']
  const binCounts = [0, 0, 0, 0, 0, 0]
  for (const r of data) {
    const m = r.tat_minutes ?? 0
    if (m < 30) binCounts[0]++
    else if (m < 60) binCounts[1]++
    else if (m < 120) binCounts[2]++
    else if (m < 240) binCounts[3]++
    else if (m < 480) binCounts[4]++
    else binCounts[5]++
  }
  let cumulative = 0
  const tat_distribution = binLabels.map((bin, i) => {
    cumulative += binCounts[i]
    return {
      bin,
      count: binCounts[i],
      cumulative_pct:
        total_count > 0 ? Math.round((cumulative / total_count) * 1000) / 10 : 0,
    }
  })

  // ===== Heatmap =====
  const heatMap = new Map<string, number>()
  for (const r of data) {
    if (r.spcm_dow != null && r.spcm_hour != null) {
      const key = `${r.spcm_dow}-${r.spcm_hour}`
      heatMap.set(key, (heatMap.get(key) ?? 0) + 1)
    }
  }
  const heatmap = Array.from(heatMap.entries()).map(([key, count]) => {
    const [dow, hour] = key.split('-').map(Number)
    return { dow, hour, count }
  })

  // ===== Phlebotomy data exists check =====
  const { count: phlebCount } = await supabaseAdmin
    .from('phleb_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('year', year)
    .eq('month', month)
  const has_phleb_data = (phlebCount ?? 0) > 0

  // ===== Filter options =====
  const { data: rawOpts } = await supabaseAdmin
    .from('tat_records')
    .select('lab_section, ward, test_name, labzone_name')
    .eq('year', year)
    .eq('month', month)

  const labSections = [...new Set((rawOpts ?? []).map(r => r.lab_section).filter(Boolean))].sort()
  const wards = [...new Set((rawOpts ?? []).map(r => r.ward).filter(Boolean))].sort()
  const testNames = [...new Set((rawOpts ?? []).map(r => r.test_name).filter(Boolean))].sort()
  const labzoneNames = [...new Set((rawOpts ?? []).map(r => r.labzone_name).filter(Boolean))].sort()

  // ===== Trend (12 months rolling) =====
  const trendMonths: { year: number; month: number }[] = []
  let ty = year, tm = month
  for (let i = 0; i < 12; i++) {
    trendMonths.unshift({ year: ty, month: tm })
    tm--
    if (tm === 0) { tm = 12; ty-- }
  }

  const trendYears = [...new Set(trendMonths.map(t => t.year))]
  const { data: trendRows } = await supabaseAdmin
    .from('tat_records')
    .select('year, month, tat_minutes, within_target')
    .in('year', trendYears)

  const trendGrouped = new Map<string, { sum: number; count: number; onTarget: number; withTarget: number }>()
  for (const t of trendMonths) {
    trendGrouped.set(`${t.year}-${t.month}`, { sum: 0, count: 0, onTarget: 0, withTarget: 0 })
  }
  for (const r of trendRows ?? []) {
    const key = `${r.year}-${r.month}`
    const g = trendGrouped.get(key)
    if (g) {
      g.sum += r.tat_minutes ?? 0
      g.count++
      if (r.within_target !== null) {
        g.withTarget++
        if (r.within_target) g.onTarget++
      }
    }
  }

  const trend = trendMonths.map(({ year: y, month: mo }) => {
    const g = trendGrouped.get(`${y}-${mo}`) ?? { sum: 0, count: 0, onTarget: 0, withTarget: 0 }
    return {
      year: y,
      month: mo,
      avg_tat: g.count > 0 ? Math.round((g.sum / g.count) * 10) / 10 : 0,
      pct_within_target:
        g.withTarget > 0 ? Math.round((g.onTarget / g.withTarget) * 1000) / 10 : 0,
    }
  })

  return NextResponse.json({
    has_phleb_data,
    kpi: {
      avg_tat,
      median_tat,
      pct_within_target,
      total_count,
      busiest_hour,
      avg_phleb_wait,
      avg_transport,
      avg_total_tat,
      median_total_tat,
      phleb_match_rate,
    },
    match_breakdown: matchCounts,
    stage_breakdown,
    by_labzone,
    by_lab_section,
    tat_distribution,
    heatmap,
    trend,
    filter_options: {
      lab_sections: labSections,
      wards,
      test_names: testNames,
      labzone_names: labzoneNames,
    },
  })
}
