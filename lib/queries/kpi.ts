import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnnualKpiRow, Department, KpiDefinition, KpiEntry, KpiSatisfaction, VwKpiDashboardRow } from '@/lib/supabase/types'
import { calcResult, isPass } from '@/lib/kpi-utils'

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

export async function getAnnualData(
  supabase: SupabaseClient,
  year: number,
  deptCode?: string
): Promise<AnnualKpiRow[]> {
  // แผนกที่ไม่นับรวมในภาพรวมกลุ่มงาน (ส่งตรวจภายนอก / จุดเจาะเลือด)
  const EXCLUDE_FROM_OVERVIEW = ['OUT', 'OPD']

  let query = supabase
    .from('vw_kpi_dashboard')
    .select('*')
    .eq('fiscal_year', year)
    .order('month')

  if (deptCode) query = query.eq('dept_code', deptCode)
  // ภาพรวม (ไม่เลือกแผนก) → ไม่นับ OUT LAB และ OPD ให้ตรงกับรายงานกลุ่มงาน
  else query = query.not('dept_code', 'in', `(${EXCLUDE_FROM_OVERVIEW.join(',')})`)

  const { data, error } = await query
  if (error) throw error
  const rows = data ?? []

  // Group by kpi_code, aggregate numerator/denominator across depts per month
  const defMap = new Map<string, Omit<AnnualKpiRow, 'months'>>()
  const aggMap = new Map<string, Map<number, { num: number; den: number | null; hasDen: boolean }>>()

  for (const r of rows) {
    if (!defMap.has(r.kpi_code)) {
      defMap.set(r.kpi_code, {
        kpi_code: r.kpi_code,
        kpi_name: r.kpi_name,
        category: r.category,
        sub_code: r.sub_code,
        target_type: r.target_type,
        target_val: r.target_val,
        unit: r.unit,
        denominator_label: null,
      })
    }
    if (!aggMap.has(r.kpi_code)) aggMap.set(r.kpi_code, new Map())
    const monthMap = aggMap.get(r.kpi_code)!
    const existing = monthMap.get(r.month)
    const num = r.numerator ?? 0
    const den = r.denominator
    if (!existing) {
      monthMap.set(r.month, { num, den: den ?? null, hasDen: den !== null })
    } else {
      monthMap.set(r.month, {
        num: existing.num + num,
        den: existing.hasDen || den !== null ? (existing.den ?? 0) + (den ?? 0) : null,
        hasDen: existing.hasDen || den !== null,
      })
    }
  }

  const result: AnnualKpiRow[] = []
  for (const [code, def] of defMap) {
    const monthMap = aggMap.get(code) ?? new Map()
    const months: AnnualKpiRow['months'] = {}
    for (const [month, agg] of monthMap) {
      const result_pct = calcResult(agg.num, agg.hasDen ? agg.den : null)
      months[month] = {
        numerator: agg.num,
        denominator: agg.hasDen ? agg.den : null,
        result_pct,
        is_pass: isPass(result_pct, def.target_type, def.target_val, def.target_type === 'eq' ? agg.num : undefined),
      }
    }
    result.push({ ...def, months })
  }
  return result
}

export async function getSatisfaction(supabase: SupabaseClient): Promise<KpiSatisfaction[]> {
  const { data, error } = await supabase
    .from('kpi_satisfaction')
    .select('*')
    .order('metric_code')
    .order('fiscal_year')
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

// All entries for a fiscal year (every dept, every month) — used by export + status matrix
export async function getYearEntries(supabase: SupabaseClient, year: number): Promise<KpiEntry[]> {
  const { data, error } = await supabase
    .from('kpi_entries')
    .select('*')
    .eq('fiscal_year', year)
  if (error) throw error
  return data ?? []
}

// dept_id list a user is assigned to fill (empty if none)
export async function getAssignedDeptIds(supabase: SupabaseClient, userId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('kpi_dept_assignees')
    .select('dept_id')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((r) => r.dept_id as number)
}

// Set of "dept_id|kpi_id" combos that a department does NOT fill
export async function getExclusions(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('kpi_dept_exclusions')
    .select('dept_id, kpi_id')
  if (error) throw error
  return new Set((data ?? []).map((r) => `${r.dept_id}|${r.kpi_id}`))
}

export interface EntryStatusRow {
  dept_id: number
  dept_code: string
  dept_name: string
  // month -> { filled, required }
  months: Record<number, { filled: number; required: number }>
}

// Per-dept, per-month completion status for a fiscal year.
// required = (# active KPI definitions) − (# excluded for that dept)
export async function getEntryStatus(supabase: SupabaseClient, year: number): Promise<EntryStatusRow[]> {
  const [depts, defs, entries, exclusions] = await Promise.all([
    getDepartments(supabase),
    getDefinitions(supabase),
    getYearEntries(supabase, year),
    getExclusions(supabase),
  ])

  const totalKpis = defs.length
  // count exclusions per dept
  const exclByDept = new Map<number, number>()
  for (const key of exclusions) {
    const deptId = Number(key.split('|')[0])
    exclByDept.set(deptId, (exclByDept.get(deptId) ?? 0) + 1)
  }

  // count filled (numerator not null) per dept per month
  const filled = new Map<string, number>() // `${dept_id}|${month}` -> count
  for (const e of entries) {
    if (e.numerator == null) continue
    const key = `${e.dept_id}|${e.month}`
    filled.set(key, (filled.get(key) ?? 0) + 1)
  }

  return depts.map((d) => {
    const required = totalKpis - (exclByDept.get(d.id) ?? 0)
    const months: EntryStatusRow['months'] = {}
    for (const m of [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      months[m] = { filled: filled.get(`${d.id}|${m}`) ?? 0, required }
    }
    return { dept_id: d.id, dept_code: d.code, dept_name: d.name_th, months }
  })
}
