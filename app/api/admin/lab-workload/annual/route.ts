import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const CACHE_ENDPOINT = 'lab-workload-summary'
const WORKLOAD_CACHE_VERSION = 'v18'

type MonthRef = { year: number; month: number }
type DepartmentRow = { section: string; ln_count: number; test_rows: number; test_count: number }
type OpdRow = { labzone_name: string; months: Record<string, number>; total: number }
type WorkloadPayload = {
  kpi?: { total_ln?: number; total_test_rows?: number; department_count?: number; opd_hn?: number }
  departments?: DepartmentRow[]
  opd_rows?: OpdRow[]
}
type SummaryRow = Record<string, any>

function toGregorianFiscalYear(year: number) {
  return year > 2400 ? year - 543 : year
}

function fiscalMonths(fiscalYear: number): MonthRef[] {
  return [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(month => ({
    year: month >= 10 ? fiscalYear - 1 : fiscalYear,
    month,
  }))
}

function monthKey(year: number, month: number) {
  return `${year}-${month}`
}

function num(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function hasMeaningfulPayload(payload: WorkloadPayload | null | undefined) {
  const kpi = payload?.kpi ?? {}
  if (num(kpi.total_ln) > 0 || num(kpi.total_test_rows) > 0 || num(kpi.opd_hn) > 0) return true
  return (payload?.departments ?? []).some(row => num(row.ln_count) > 0 || num(row.test_rows) > 0)
    || (payload?.opd_rows ?? []).some(row => num(row.total) > 0)
}

async function readLatestPayload(year: number, month: number) {
  const precomputed = await readPrecomputedPayload(year, month)
  if (precomputed) return precomputed

  const { data, error } = await supabaseAdmin
    .from('analysis_summary_cache')
    .select('cache_key,payload')
    .eq('endpoint', CACHE_ENDPOINT)
    .eq('year', year)
    .eq('month', month)
    .gt('expires_at', new Date().toISOString())
    .like('cache_key', `${WORKLOAD_CACHE_VERSION}|%`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  const payload = (data?.payload as WorkloadPayload | undefined) ?? null
  return hasMeaningfulPayload(payload) ? payload : null
}

async function readPrecomputedPayload(year: number, month: number): Promise<WorkloadPayload | null> {
  const [overallRes, deptRes, phlebRes] = await Promise.all([
    supabaseAdmin
      .from('lab_workload_overall_monthly')
      .select('ln_count,test_rows')
      .eq('year', year)
      .eq('month', month)
      .maybeSingle(),
    supabaseAdmin
      .from('lab_workload_department_monthly')
      .select('lab_section,ln_count,test_rows,test_count')
      .eq('year', year)
      .eq('month', month),
    supabaseAdmin
      .from('lab_workload_phleb_monthly')
      .select('labzone_name,service_count')
      .eq('year', year)
      .eq('month', month),
  ])

  const missingTable = [overallRes, deptRes, phlebRes].some(res => res.error?.code === '42P01')
  if (missingTable) return null

  const departments = ((deptRes.data ?? []) as SummaryRow[])
    .map(row => ({
      section: String(row.lab_section ?? ''),
      ln_count: num(row.ln_count),
      test_rows: num(row.test_rows),
      test_count: num(row.test_count),
    }))
    .filter(row => row.section)

  const opdRows = ((phlebRes.data ?? []) as SummaryRow[])
    .map(row => {
      const value = num(row.service_count)
      return {
        labzone_name: String(row.labzone_name ?? ''),
        months: { [monthKey(year, month)]: value },
        total: value,
      }
    })
    .filter(row => row.labzone_name && row.total > 0)

  const payload = {
    kpi: {
      total_ln: num((overallRes.data as SummaryRow | null)?.ln_count),
      total_test_rows: num((overallRes.data as SummaryRow | null)?.test_rows),
      department_count: departments.length,
      opd_hn: opdRows.reduce((sum, row) => sum + row.total, 0),
    },
    departments,
    opd_rows: opdRows,
  }

  return hasMeaningfulPayload(payload) ? payload : null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const displayFiscalYear = Number(req.nextUrl.searchParams.get('year'))
  if (!displayFiscalYear) return NextResponse.json({ error: 'year required' }, { status: 422 })

  const fiscalYear = toGregorianFiscalYear(displayFiscalYear)
  const months = fiscalMonths(fiscalYear)
  const payloads = await Promise.all(months.map(ym => readLatestPayload(ym.year, ym.month)))

  const deptMap = new Map<string, DepartmentRow & { months: Record<string, { ln_count: number; test_rows: number }> }>()
  const opdMap = new Map<string, OpdRow>()

  let totalLn = 0
  let totalRows = 0
  let opdHn = 0

  const trend = months.map((ym, index) => {
    const payload = payloads[index]
    const kpi = payload?.kpi ?? {}
    const ln = num(kpi.total_ln)
    const rows = num(kpi.total_test_rows)
    const opd = num(kpi.opd_hn)
    totalLn += ln
    totalRows += rows
    opdHn += opd

    for (const dept of payload?.departments ?? []) {
      const current = deptMap.get(dept.section) ?? {
        section: dept.section,
        ln_count: 0,
        test_rows: 0,
        test_count: 0,
        months: {},
      }
      current.ln_count += num(dept.ln_count)
      current.test_rows += num(dept.test_rows)
      current.test_count = Math.max(current.test_count, num(dept.test_count))
      current.months[monthKey(ym.year, ym.month)] = {
        ln_count: num(dept.ln_count),
        test_rows: num(dept.test_rows),
      }
      deptMap.set(dept.section, current)
    }

    for (const row of payload?.opd_rows ?? []) {
      const current = opdMap.get(row.labzone_name) ?? {
        labzone_name: row.labzone_name,
        months: Object.fromEntries(months.map(m => [monthKey(m.year, m.month), 0])),
        total: 0,
      }
      const value = num(row.months?.[monthKey(ym.year, ym.month)])
      current.months[monthKey(ym.year, ym.month)] = value
      current.total += value
      opdMap.set(row.labzone_name, current)
    }

    return {
      year: ym.year,
      month: ym.month,
      has_data: !!payload,
      ln_count: ln,
      test_rows: rows,
      opd_hn: opd,
    }
  })

  const departments = Array.from(deptMap.values())
    .map(row => ({
      section: row.section,
      ln_count: row.ln_count,
      test_rows: row.test_rows,
      test_count: row.test_count,
      months: Object.fromEntries(months.map(ym => {
        const key = monthKey(ym.year, ym.month)
        return [key, row.months[key] ?? { ln_count: 0, test_rows: 0 }]
      })),
    }))
    .filter(row => row.ln_count > 0 || row.test_rows > 0)
    .sort((a, b) => b.ln_count - a.ln_count)

  return NextResponse.json({
    fiscal_year: displayFiscalYear,
    selected_year: fiscalYear,
    months,
    kpi: {
      total_ln: totalLn,
      total_test_rows: totalRows,
      department_count: departments.length,
      opd_hn: opdHn,
      data_months: payloads.filter(Boolean).length,
    },
    trend,
    departments,
    opd_rows: Array.from(opdMap.values()).filter(row => row.total > 0).sort((a, b) => b.total - a.total),
  })
}
