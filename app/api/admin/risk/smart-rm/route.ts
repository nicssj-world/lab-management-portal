import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRiskActor, getRiskPermission } from '@/lib/risk/access'

const FETCH_CHUNK = 1000
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const TOP_N = 10
const LATEST_N = 10

type AnalyticsRow = {
  event_date: string | null
  department_found: string | null
  risk_type: string | null
  event_main_category: string | null
  event_sub_category: string | null
  severity_level: string | null
  ior_status: string | null
  external_no: string
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, m => `\\${m}`)
}

/** ปีงบประมาณไทย เริ่ม 1 ต.ค. ของปีก่อนหน้า */
function fiscalYearRange(value: string | null) {
  const displayYear = Number(value)
  if (!value || !Number.isInteger(displayYear)) return null
  const fiscalYear = displayYear > 2400 ? displayYear - 543 : displayYear
  return { fiscalYear, start: `${fiscalYear - 1}-10-01`, end: `${fiscalYear}-09-30` }
}

function monthRange(range: ReturnType<typeof fiscalYearRange>, month: string | null) {
  if (!range || !month || !/^\d{2}$/.test(month)) return null
  const m = Number(month)
  if (m < 1 || m > 12) return null
  const year = m >= 10 ? range.fiscalYear - 1 : range.fiscalYear
  const lastDay = new Date(year, m, 0).getDate()
  return { start: `${year}-${month}-01`, end: `${year}-${month}-${String(lastDay).padStart(2, '0')}` }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, sp: URLSearchParams) {
  const severity = sp.get('severity')
  const department = sp.get('department')
  const riskType = sp.get('riskType')
  const q = (sp.get('q') ?? '').trim()
  const range = fiscalYearRange(sp.get('year'))
  const month = monthRange(range, sp.get('month'))

  if (severity) query = query.eq('severity_level', severity)
  if (department) query = query.eq('department_found', department)
  if (riskType) query = query.eq('risk_type', riskType)
  if (month) query = query.gte('event_date', month.start).lte('event_date', month.end)
  else if (range) query = query.gte('event_date', range.start).lte('event_date', range.end)
  if (q) {
    const pattern = `%${escapeLike(q)}%`
    query = query.or([
      `external_no.ilike.${pattern}`,
      `event_detail.ilike.${pattern}`,
      `department_found.ilike.${pattern}`,
      `department_target.ilike.${pattern}`,
      `event_main_category.ilike.${pattern}`,
      `event_sub_category.ilike.${pattern}`,
    ].join(','))
  }
  return query
}

async function fetchList(sp: URLSearchParams) {
  const page = parsePositiveInt(sp.get('page'), 1)
  const pageSize = Math.min(parsePositiveInt(sp.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)
  const from = (page - 1) * pageSize

  let query = supabaseAdmin
    .from('smart_rm_events')
    .select('*', { count: 'exact' })
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })

  query = applyFilters(query, sp)
  const { data, error, count } = await query.range(from, from + pageSize - 1)
  if (error) throw error
  return { data: data ?? [], count: count ?? 0, page, pageSize }
}

function tally(rows: AnalyticsRow[], pick: (row: AnalyticsRow) => string | null | undefined, limit: number) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = pick(row)?.trim() || 'ไม่ระบุ'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

function typeGroup(riskType?: string | null) {
  const value = (riskType ?? '').toLowerCase()
  if (value.includes('non')) return 'Non-Clinic'
  if (value.includes('clinic')) return 'Clinic'
  return 'ไม่ระบุ'
}

/**
 * สรุปข้อมูลฝั่ง server แล้วส่งเฉพาะตัวเลขที่กราฟต้องใช้
 * ระบบเดิมโหลดทุกแถวไปให้เบราว์เซอร์คำนวณเอง ซึ่งหนักขึ้นเรื่อย ๆ ตามข้อมูลที่นำเข้า
 */
async function fetchAnalytics(sp: URLSearchParams) {
  const columns = 'external_no, event_date, department_found, risk_type, event_main_category, event_sub_category, severity_level, ior_status'
  const rows: AnalyticsRow[] = []
  for (let from = 0; ; from += FETCH_CHUNK) {
    let query = supabaseAdmin
      .from('smart_rm_events')
      .select(columns)
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
    query = applyFilters(query, sp)
    const { data, error } = await query.range(from, from + FETCH_CHUNK - 1)
    if (error) throw error
    rows.push(...((data ?? []) as unknown as AnalyticsRow[]))
    if (!data || data.length < FETCH_CHUNK) break
  }

  const monthlyMap = new Map<string, number>()
  const severityMap = new Map<string, number>()
  for (const row of rows) {
    const monthKey = (row.event_date ?? '').slice(0, 7)
    if (monthKey) monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + 1)
    const severity = row.severity_level ?? ''
    if (severity) severityMap.set(severity, (severityMap.get(severity) ?? 0) + 1)
  }

  const monthly = Array.from(monthlyMap, ([name, value]) => ({ name, value }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(-12)

  const clinic = rows.filter(r => typeGroup(r.risk_type) === 'Clinic').length
  const nonClinic = rows.filter(r => typeGroup(r.risk_type) === 'Non-Clinic').length

  return {
    total: rows.length,
    clinic,
    nonClinic,
    severe: rows.filter(r => ['E', 'F', 'G', 'H', 'I'].includes(r.severity_level ?? '')).length,
    monthCount: monthlyMap.size,
    monthly,
    severity: 'ABCDEFGHI'.split('').map(letter => ({ name: letter, value: severityMap.get(letter) ?? 0 })),
    departments: tally(rows, r => r.department_found, TOP_N),
    categories: tally(rows, r => r.event_main_category ?? r.event_sub_category, 8),
    latest: rows.slice(0, LATEST_N),
  }
}

export async function GET(req: NextRequest) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRiskPermission(actor.role)) === 'none') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = req.nextUrl.searchParams
  try {
    return NextResponse.json(
      sp.get('view') === 'analytics' ? await fetchAnalytics(sp) : await fetchList(sp),
    )
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
