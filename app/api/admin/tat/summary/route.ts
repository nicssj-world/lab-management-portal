import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

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

  // Main data for selected month
  let q = supabaseAdmin
    .from('tat_records')
    .select('tat_minutes, target_minutes, within_target, lab_section, ward, priority, test_name, spcm_hour, spcm_dow')
    .eq('year', year)
    .eq('month', month)

  if (lab_section) q = q.eq('lab_section', lab_section)
  if (ward) q = q.eq('ward', ward)
  if (priority) q = q.eq('priority', priority)
  if (test_name) q = q.eq('test_name', test_name)

  const { data: rows, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const data = rows ?? []

  // KPI
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

  // By lab section
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

  // Distribution
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

  // Heatmap
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

  // Filter options (distinct values for current month, no extra filters)
  const { data: rawOpts } = await supabaseAdmin
    .from('tat_records')
    .select('lab_section, ward, test_name')
    .eq('year', year)
    .eq('month', month)

  const labSections = [...new Set((rawOpts ?? []).map(r => r.lab_section).filter(Boolean))].sort()
  const wards = [...new Set((rawOpts ?? []).map(r => r.ward).filter(Boolean))].sort()
  const testNames = [...new Set((rawOpts ?? []).map(r => r.test_name).filter(Boolean))].sort()

  // Trend — 12 months rolling back from selected month (no extra filters)
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
    kpi: { avg_tat, median_tat, pct_within_target, total_count, busiest_hour },
    by_lab_section,
    tat_distribution,
    heatmap,
    trend,
    filter_options: { lab_sections: labSections, wards, test_names: testNames },
  })
}
