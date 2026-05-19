import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkloadDepartment, WorkloadEntry } from '@/lib/supabase/types'

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

export interface WorkloadTrendRow {
  month: number
  dept_code: string
  pct: number
  total_count: number
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
