import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const CACHE_ENDPOINT = 'lab-workload-summary'

type MonthRef = { year: number; month: number }
type DepartmentRow = { section: string; ln_count: number; test_rows: number; test_count: number }
type OpdRow = { labzone_name: string; months: Record<string, number>; total: number }
type WorkloadPayload = {
  kpi?: { total_ln?: number; total_test_rows?: number; department_count?: number; opd_hn?: number }
  departments?: DepartmentRow[]
  opd_rows?: OpdRow[]
}

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

async function readLatestPayload(year: number, month: number) {
  const { data, error } = await supabaseAdmin
    .from('analysis_summary_cache')
    .select('payload')
    .eq('endpoint', CACHE_ENDPOINT)
    .eq('year', year)
    .eq('month', month)
    .gt('expires_at', new Date().toISOString())
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  return (data?.payload as WorkloadPayload | undefined) ?? null
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
