import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnnualKpiRow, Department, KpiDefinition, KpiEntry, KpiSatisfaction, VwKpiDashboardRow } from '@/lib/supabase/types'
import { calcResult, getFiscalMonths, isPass } from '@/lib/kpi-utils'
import { filterAnnualRowsByExclusions } from '@/lib/kpi/annual-exclusions'
import { isKpiEntryComplete } from '@/lib/kpi/entry-completeness'

const KPI_ENTRY_PAGE_SIZE = 1000
const KPI_VIEW_PAGE_SIZE = 1000

/**
 * Re-apply the current Settings definition to view rows. The database view is
 * also maintained by migration SQL, but normalizing here protects the app
 * while an existing deployment is waiting for that migration and prevents
 * historical entry shape from changing the metric type.
 */
export function normalizeKpiDashboardRows(
  rows: Array<VwKpiDashboardRow & { denominator_label?: string | null }>,
  definitions: KpiDefinition[],
): VwKpiDashboardRow[] {
  const definitionByCode = new Map(definitions.map((definition) => [definition.code, definition]))
  return rows.map((row) => {
    const definition = definitionByCode.get(row.kpi_code)
    if (!definition) return { ...row, denominator_label: row.denominator_label ?? null }

    const isCountMetric = definition.denominator === null
    const hasNumerator = row.numerator !== null && Number.isFinite(row.numerator)
    const denominator = row.denominator
    const result_pct = !isCountMetric && hasNumerator && denominator !== null && Number.isFinite(denominator) && denominator >= 0
      ? calcResult(row.numerator!, denominator)
      : null
    return {
      ...row,
      target_type: definition.target_type,
      target_val: definition.target_val,
      unit: definition.unit,
      denominator_label: definition.denominator,
      result_pct,
      is_pass: isPass(
        result_pct,
        definition.target_type,
        definition.target_val,
        hasNumerator ? row.numerator! : undefined,
        isCountMetric,
      ),
    }
  })
}

export async function getDashboard(
  supabase: SupabaseClient,
  year: number,
  month: number,
  dept?: string
): Promise<VwKpiDashboardRow[]> {
  let rows: VwKpiDashboardRow[] = []
  for (let from = 0; ; from += KPI_VIEW_PAGE_SIZE) {
    let query = supabase
      .from('vw_kpi_dashboard')
      .select('*')
      .eq('fiscal_year', year)
      .eq('month', month)
      .order('kpi_code')
      .order('dept_code')
      .range(from, from + KPI_VIEW_PAGE_SIZE - 1)

    if (dept) query = query.eq('dept_code', dept)

    const { data, error } = await query
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < KPI_VIEW_PAGE_SIZE) break
  }
  return normalizeKpiDashboardRows(rows, await getDefinitions(supabase))
}

export async function getDeptTrend(
  supabase: SupabaseClient,
  deptCode: string,
  year: number
): Promise<VwKpiDashboardRow[]> {
  let rows: VwKpiDashboardRow[] = []
  for (let from = 0; ; from += KPI_VIEW_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('vw_kpi_dashboard')
      .select('*')
      .eq('dept_code', deptCode)
      .eq('fiscal_year', year)
      .order('month')
      .order('kpi_code')
      .range(from, from + KPI_VIEW_PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < KPI_VIEW_PAGE_SIZE) break
  }
  return normalizeKpiDashboardRows(rows, await getDefinitions(supabase))
}

export interface UpsertKpiRow {
  dept_id: number
  kpi_id: number
  fiscal_year: number
  month: number
  numerator: number
  denominator: number | null
}

export interface ClearKpiRow {
  dept_id: number
  kpi_id: number
  fiscal_year: number
  month: number
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

export async function deleteEntries(supabase: SupabaseClient, rows: ClearKpiRow[]): Promise<void> {
  const groups = new Map<string, { dept_id: number; fiscal_year: number; month: number; kpi_ids: number[] }>()
  for (const row of rows) {
    const key = `${row.dept_id}|${row.fiscal_year}|${row.month}`
    const group = groups.get(key) ?? { dept_id: row.dept_id, fiscal_year: row.fiscal_year, month: row.month, kpi_ids: [] }
    group.kpi_ids.push(row.kpi_id)
    groups.set(key, group)
  }

  for (const group of groups.values()) {
    const { error } = await supabase
      .from('kpi_entries')
      .delete()
      .eq('dept_id', group.dept_id)
      .eq('fiscal_year', group.fiscal_year)
      .eq('month', group.month)
      .in('kpi_id', group.kpi_ids)
    if (error) throw error
  }
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
  deptCode?: string,
  exclusions: ReadonlySet<string> = new Set(),
  visibleDeptCodes?: ReadonlySet<string>,
): Promise<AnnualKpiRow[]> {
  // แผนกที่ไม่นับรวมในภาพรวมกลุ่มงาน (ส่งตรวจภายนอก / จุดเจาะเลือด)
  const EXCLUDE_FROM_OVERVIEW = ['OUT', 'OPD']

  let rows: VwKpiDashboardRow[] = []
  for (let from = 0; ; from += KPI_VIEW_PAGE_SIZE) {
    let query = supabase
      .from('vw_kpi_dashboard')
      .select('*')
      .eq('fiscal_year', year)
      .order('month')
      .range(from, from + KPI_VIEW_PAGE_SIZE - 1)

    if (deptCode) query = query.eq('dept_code', deptCode)
    else if (visibleDeptCodes && visibleDeptCodes.size > 0) query = query.in('dept_code', [...visibleDeptCodes])
    // ภาพรวม (ไม่เลือกแผนก) → ไม่นับ OUT LAB และ OPD ให้ตรงกับรายงานกลุ่มงาน
    else query = query.not('dept_code', 'in', `(${EXCLUDE_FROM_OVERVIEW.join(',')})`)

    const { data, error } = await query
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < KPI_VIEW_PAGE_SIZE) break
  }

  // The definition table is the source of truth for KPI type, target and
  // denominator semantics. View rows may contain legacy values that no
  // longer match the current Settings screen.
  const definitions = await getDefinitions(supabase)
  let scopedDepartments: Department[] | null = null

  if (exclusions.size > 0) {
    const depts = await getDepartments(supabase)
    scopedDepartments = deptCode
      ? depts.filter((dept) => dept.code === deptCode)
      : visibleDeptCodes && visibleDeptCodes.size > 0
        ? depts.filter((dept) => visibleDeptCodes.has(dept.code))
        : depts.filter((dept) => !EXCLUDE_FROM_OVERVIEW.includes(dept.code))
    rows = filterAnnualRowsByExclusions(
      rows,
      new Map(depts.map((dept) => [dept.code, dept])),
      new Map(definitions.map((def) => [def.code, def])),
      exclusions,
    )
  }

  // A definition remains visible even when it has no entries for this year.
  // This keeps the annual report aligned with the Settings screen instead of
  // silently dropping newly created or not-yet-filled KPIs.
  const relevantDefinitions = definitions.filter((definition) => {
    if (!scopedDepartments) return true
    return scopedDepartments.some((dept) => !exclusions.has(`${dept.id}|${definition.id}`))
  })
  const defMap = new Map<string, KpiDefinition>(relevantDefinitions.map((definition) => [definition.code, definition]))
  const aggMap = new Map<string, Map<number, {
    num: number
    hasNum: boolean
    den: number
    hasDen: boolean
    invalid: boolean
  }>>()

  for (const r of rows) {
    const definition = defMap.get(r.kpi_code)
    if (!definition) continue
    if (!aggMap.has(r.kpi_code)) aggMap.set(r.kpi_code, new Map())
    const monthMap = aggMap.get(r.kpi_code)!
    const existing = monthMap.get(r.month)
    const hasNum = r.numerator !== null && Number.isFinite(r.numerator)
    const num = hasNum ? r.numerator! : 0
    const hasDen = r.denominator !== null && Number.isFinite(r.denominator)
    const den = hasDen ? r.denominator! : 0
    const invalid = !hasNum || (
      definition.denominator !== null && (!hasDen || den < 0 || (den === 0 && num !== 0))
    )
    if (!existing) {
      monthMap.set(r.month, { num, hasNum, den, hasDen, invalid })
    } else {
      monthMap.set(r.month, {
        num: existing.num + num,
        hasNum: existing.hasNum || hasNum,
        den: existing.den + den,
        hasDen: existing.hasDen || hasDen,
        invalid: existing.invalid || invalid,
      })
    }
  }

  const result: AnnualKpiRow[] = []
  for (const [code, definition] of defMap) {
    const monthMap = aggMap.get(code) ?? new Map()
    const months: AnnualKpiRow['months'] = {}
    for (const month of getFiscalMonths()) {
      const agg = monthMap.get(month)
      if (!agg || !agg.hasNum) {
        months[month] = { numerator: null, denominator: null, result_pct: null, is_pass: null }
        continue
      }
      const isCountMetric = definition.denominator === null
      const result_pct = !isCountMetric && !agg.invalid
        ? calcResult(agg.num, agg.hasDen ? agg.den : null)
        : null
      months[month] = {
        numerator: agg.num,
        denominator: isCountMetric || agg.invalid || !agg.hasDen ? null : agg.den,
        result_pct,
        is_pass: isPass(
          result_pct,
          definition.target_type,
          definition.target_val,
          isCountMetric ? agg.num : undefined,
          isCountMetric,
        ),
      }
    }
    result.push({
      kpi_code: definition.code,
      kpi_name: definition.name_th,
      category: definition.category,
      sub_code: definition.sub_code,
      target_type: definition.target_type,
      target_val: definition.target_val,
      unit: definition.unit,
      denominator_label: definition.denominator,
      months,
    })
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
  const rows: KpiEntry[] = []

  for (let from = 0; ; from += KPI_ENTRY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('kpi_entries')
      .select('*')
      .eq('fiscal_year', year)
      .order('id', { ascending: true })
      .range(from, from + KPI_ENTRY_PAGE_SIZE - 1)
    if (error) throw error

    rows.push(...(data ?? []))
    if (!data || data.length < KPI_ENTRY_PAGE_SIZE) break
  }

  return rows
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

export function filterEntryStatusByDeptIds(
  rows: EntryStatusRow[],
  deptIds: ReadonlySet<number>,
): EntryStatusRow[] {
  return rows.filter((row) => deptIds.has(row.dept_id))
}

export function buildEntryStatus(
  depts: Array<Pick<Department, 'id' | 'code' | 'name_th'>>,
  defs: Array<Pick<KpiDefinition, 'id' | 'denominator'>>,
  entries: Array<Pick<KpiEntry, 'dept_id' | 'kpi_id' | 'month' | 'numerator' | 'denominator'>>,
  exclusions: ReadonlySet<string>,
): EntryStatusRow[] {
  const defById = new Map(defs.map((def) => [def.id, def]))
  const requiredIdsByDept = new Map<number, Set<number>>()
  for (const dept of depts) {
    requiredIdsByDept.set(
      dept.id,
      new Set(defs.filter((def) => !exclusions.has(`${dept.id}|${def.id}`)).map((def) => def.id)),
    )
  }

  // Count only entries for KPI definitions the department is required to fill.
  const filled = new Map<string, number>() // `${dept_id}|${month}` -> count
  for (const entry of entries) {
    const def = defById.get(entry.kpi_id)
    if (
      !def ||
      !isKpiEntryComplete(entry.numerator, entry.denominator, def) ||
      !requiredIdsByDept.get(entry.dept_id)?.has(entry.kpi_id)
    ) continue
    const key = `${entry.dept_id}|${entry.month}`
    filled.set(key, (filled.get(key) ?? 0) + 1)
  }

  return depts.map((d) => {
    const required = requiredIdsByDept.get(d.id)?.size ?? 0
    const months: EntryStatusRow['months'] = {}
    for (const m of [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      months[m] = { filled: filled.get(`${d.id}|${m}`) ?? 0, required }
    }
    return { dept_id: d.id, dept_code: d.code, dept_name: d.name_th, months }
  })
}

// Per-dept, per-month completion status for a fiscal year.
// required and filled both include only KPI definitions applicable to that department.
export async function getEntryStatus(supabase: SupabaseClient, year: number): Promise<EntryStatusRow[]> {
  const [depts, defs, entries, exclusions] = await Promise.all([
    getDepartments(supabase),
    getDefinitions(supabase),
    getYearEntries(supabase, year),
    getExclusions(supabase),
  ])

  return buildEntryStatus(depts, defs, entries, exclusions)
}
