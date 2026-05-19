import type { SupabaseClient } from '@supabase/supabase-js'
import type { Department, KpiDefinition, KpiEntry, VwKpiDashboardRow } from '@/lib/supabase/types'
import { calcResult } from '@/lib/kpi-utils'

export async function getDashboard(
  supabase: SupabaseClient,
  year: number,
  month: number,
  dept?: string
): Promise<VwKpiDashboardRow[]> {
  let query = supabase
    .from('vw_kpi_dashboard')
    .select('*')
    .eq('fiscal_year', year)
    .eq('month', month)

  if (dept) query = query.eq('dept_code', dept)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getDeptTrend(
  supabase: SupabaseClient,
  deptCode: string,
  year: number
): Promise<VwKpiDashboardRow[]> {
  const { data, error } = await supabase
    .from('vw_kpi_dashboard')
    .select('*')
    .eq('dept_code', deptCode)
    .eq('fiscal_year', year)
    .order('month')
  if (error) throw error
  return data ?? []
}

export interface UpsertKpiRow {
  dept_id: number
  kpi_id: number
  fiscal_year: number
  month: number
  numerator: number
  denominator: number | null
}

export async function upsertEntries(supabase: SupabaseClient, rows: UpsertKpiRow[]): Promise<void> {
  const entries = rows.map((r) => ({
    ...r,
    result_pct: calcResult(r.numerator, r.denominator),
  }))
  const { error } = await supabase
    .from('kpi_entries')
    .upsert(entries, { onConflict: 'dept_id,kpi_id,fiscal_year,month' })
  if (error) throw error
}

export async function getDepartments(supabase: SupabaseClient): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('is_active', true)
    .order('code')
  if (error) throw error
  return data ?? []
}

export async function getDefinitions(supabase: SupabaseClient): Promise<KpiDefinition[]> {
  const { data, error } = await supabase
    .from('kpi_definitions')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function getKpiEntries(
  supabase: SupabaseClient,
  year: number,
  month: number,
  deptId: number
): Promise<KpiEntry[]> {
  const { data, error } = await supabase
    .from('kpi_entries')
    .select('*')
    .eq('fiscal_year', year)
    .eq('month', month)
    .eq('dept_id', deptId)
  if (error) throw error
  return data ?? []
}
