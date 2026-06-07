import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkloadDepartment, WorkloadEntry } from '@/lib/supabase/types'
import { getFiscalMonths } from '@/lib/kpi-utils'

export interface WorkloadSummaryRow {
  dept_id: number
  dept_name: string
  dept_code: string
  dept_color: string
  in_time_count: number
  total_count: number
  pct: number
}

export interface WorkloadDetailRow {
  test_id: number
  ephis_code: string
  test_name: string
  price: number | null
  in_time_count: number
  total_count: number
  pct: number
}

export interface WorkloadAnnualDetailMonth {
  in_time_count: number
  total_count: number
  pct: number
}

export interface WorkloadAnnualDetailRow {
  test_id: number
  ephis_code: string | null
  test_name: string
  price: number | null
  months: Record<number, WorkloadAnnualDetailMonth>
  in_time_count: number
  total_count: number
  pct: number
}

export interface WorkloadTrendRow {
  month: number
  dept_code: string
  pct: number
  total_count: number
}

function calcPct(inTime: number, total: number) {
  return total > 0 ? Math.round((inTime / total) * 100 * 10) / 10 : 0
}

function emptyAnnualMonths(): Record<number, WorkloadAnnualDetailMonth> {
  return Object.fromEntries(
    getFiscalMonths().map((month) => [month, { in_time_count: 0, total_count: 0, pct: 0 }])
  ) as Record<number, WorkloadAnnualDetailMonth>
}

export async function getWorkloadSummary(
  supabase: SupabaseClient,
  year: number,
  month: number
): Promise<WorkloadSummaryRow[]> {
  const { data, error } = await supabase
    .from('workload_entries')
    .select(`
      in_time_count,
      total_count,
      workload_tests!inner(
        ephis_code,
        test_name,
        price,
        workload_departments!inner(id, name, code, color)
      )
    `)
    .eq('fiscal_year', year)
    .eq('month', month)
  if (error) throw error

  const deptMap = new Map<number, WorkloadSummaryRow>()
  for (const row of data ?? []) {
    const dept = (row as any).workload_tests.workload_departments
    const existing = deptMap.get(dept.id) ?? {
      dept_id: dept.id, dept_name: dept.name, dept_code: dept.code, dept_color: dept.color,
      in_time_count: 0, total_count: 0, pct: 0,
    }
    existing.in_time_count += row.in_time_count
    existing.total_count += row.total_count
    deptMap.set(dept.id, existing)
  }

  return Array.from(deptMap.values()).map((d) => ({
    ...d,
    pct: d.total_count > 0 ? Math.round((d.in_time_count / d.total_count) * 100 * 10) / 10 : 0,
  }))
}

export async function getDeptDetail(
  supabase: SupabaseClient,
  deptCode: string,
  year: number,
  month: number
): Promise<WorkloadDetailRow[]> {
  const { data, error } = await supabase
    .from('workload_entries')
    .select(`
      test_id,
      in_time_count,
      total_count,
      workload_tests!inner(
        ephis_code,
        test_name,
        price,
        workload_departments!inner(code)
      )
    `)
    .eq('fiscal_year', year)
    .eq('month', month)
    .eq('workload_tests.workload_departments.code', deptCode)
  if (error) throw error

  return (data ?? []).map((row: any) => ({
    test_id: row.test_id,
    ephis_code: row.workload_tests.ephis_code,
    test_name: row.workload_tests.test_name,
    price: row.workload_tests.price,
    in_time_count: row.in_time_count,
    total_count: row.total_count,
    pct: row.total_count > 0 ? Math.round((row.in_time_count / row.total_count) * 100 * 10) / 10 : 0,
  }))
}

export async function getDeptAnnualDetail(
  supabase: SupabaseClient,
  deptCode: string,
  year: number
): Promise<WorkloadAnnualDetailRow[]> {
  const { data: tests, error: testsError } = await supabase
    .from('workload_tests')
    .select(`
      id,
      ephis_code,
      test_name,
      price,
      workload_departments!inner(code)
    `)
    .eq('workload_departments.code', deptCode)
    .order('test_name')
  if (testsError) throw testsError

  const testRows = (tests ?? []) as {
    id: number
    ephis_code: string | null
    test_name: string
    price: number | null
  }[]
  const testIds = testRows.map((row) => row.id)
  if (testIds.length === 0) return []

  const rowMap = new Map<number, WorkloadAnnualDetailRow>()
  for (const test of testRows) {
    rowMap.set(test.id, {
      test_id: test.id,
      ephis_code: test.ephis_code,
      test_name: test.test_name,
      price: test.price,
      months: emptyAnnualMonths(),
      in_time_count: 0,
      total_count: 0,
      pct: 0,
    })
  }

  const { data: entries, error: entriesError } = await supabase
    .from('workload_entries')
    .select('test_id, month, in_time_count, total_count')
    .eq('fiscal_year', year)
    .in('test_id', testIds)
  if (entriesError) throw entriesError

  for (const entry of entries ?? []) {
    const row = rowMap.get(Number(entry.test_id))
    if (!row) continue
    const month = Number(entry.month)
    const current = row.months[month] ?? { in_time_count: 0, total_count: 0, pct: 0 }
    current.in_time_count += Number(entry.in_time_count ?? 0)
    current.total_count += Number(entry.total_count ?? 0)
    row.months[month] = current
    row.in_time_count += Number(entry.in_time_count ?? 0)
    row.total_count += Number(entry.total_count ?? 0)
  }

  return Array.from(rowMap.values())
    .map((row) => {
      for (const month of getFiscalMonths()) {
        const value = row.months[month]
        value.pct = calcPct(value.in_time_count, value.total_count)
      }
      row.pct = calcPct(row.in_time_count, row.total_count)
      return row
    })
    .filter((row) => row.total_count > 0)
    .sort((a, b) => b.total_count - a.total_count || a.test_name.localeCompare(b.test_name))
}

export async function getMonthlyTrend(
  supabase: SupabaseClient,
  year: number
): Promise<WorkloadTrendRow[]> {
  const { data, error } = await supabase
    .from('workload_entries')
    .select(`
      fiscal_year,
      month,
      in_time_count,
      total_count,
      workload_tests!inner(workload_departments!inner(code))
    `)
    .eq('fiscal_year', year)
  if (error) throw error

  const grouped = new Map<string, { month: number; dept_code: string; in_time: number; total: number }>()
  for (const row of data ?? []) {
    const code = (row as any).workload_tests.workload_departments.code
    const key = `${code}-${row.month}`
    const existing = grouped.get(key) ?? { month: row.month, dept_code: code, in_time: 0, total: 0 }
    existing.in_time += row.in_time_count
    existing.total += row.total_count
    grouped.set(key, existing)
  }

  return Array.from(grouped.values()).map((g) => ({
    month: g.month,
    dept_code: g.dept_code,
    pct: g.total > 0 ? Math.round((g.in_time / g.total) * 100 * 10) / 10 : 0,
    total_count: g.total,
  }))
}

export async function upsertWorkload(
  supabase: SupabaseClient,
  rows: Pick<WorkloadEntry, 'test_id' | 'fiscal_year' | 'month' | 'in_time_count' | 'total_count'>[]
): Promise<void> {
  const { error } = await supabase
    .from('workload_entries')
    .upsert(rows, { onConflict: 'test_id,fiscal_year,month' })
  if (error) throw error
}

export async function getWorkloadDepts(supabase: SupabaseClient): Promise<WorkloadDepartment[]> {
  const { data, error } = await supabase
    .from('workload_departments')
    .select('*')
    .order('code')
  if (error) throw error
  return data ?? []
}
