import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Department,
  KpiDefinition,
  KpiDefinitionVersion,
  KpiEntry,
  KpiSubmissionPeriod,
  KpiSubmissionRequirement,
} from '@/lib/supabase/types'
import {
  compareFiscalPeriods,
  getSubmissionDeadline,
  classifySubmissionStatus,
  getSubmittedAfterDeadlineAt,
  getSubmissionStatusLabel,
  type FiscalPeriod,
  type SubmissionStatus,
} from '@/lib/kpi/compliance'
import { getFiscalMonths } from '@/lib/kpi-utils'
import { isKpiEntryComplete } from '@/lib/kpi/entry-completeness'
import { getDepartments } from '@/lib/queries/kpi'

export interface KpiSubmissionSettings {
  tracking_start_fiscal_year: number
  tracking_start_month: number
  baseline_fiscal_year: number
  baseline_month: number
  deadline_day: number
}

export interface KpiCompliancePeriod extends KpiSubmissionPeriod {
  dept_code: string
  dept_name: string
}

export interface KpiComplianceSummary {
  on_time: number
  missed: number
  pending: number
  not_open: number
  not_tracked: number
  not_applicable: number
  due_periods: number
  compliance_rate: number | null
}

export interface KpiComplianceResponse {
  year: number
  months: number[]
  tracking_start: FiscalPeriod
  baseline: FiscalPeriod
  settings: KpiSubmissionSettings
  summary: KpiComplianceSummary
  periods: KpiCompliancePeriod[]
  rows: Array<{
    dept_id: number
    dept_code: string
    dept_name: string
    months: Record<number, KpiCompliancePeriod>
  }>
  late_items: KpiCompliancePeriod[]
}

export interface KpiComplianceDetailRequirement extends KpiSubmissionRequirement {
  filled: boolean
  numerator: number | null
  denominator_value: number | null
  result_pct: number | null
  updated_at: string | null
}

export interface KpiComplianceDetail {
  department: Pick<Department, 'id' | 'code' | 'name_th'>
  period: KpiSubmissionPeriod
  requirements: KpiComplianceDetailRequirement[]
  missing: KpiComplianceDetailRequirement[]
  submitted_after_deadline_at: string | null
}

type ReconcileOptions = {
  deptId: number
  fiscalYear: number
  month: number
}

export async function saveKpiEntriesAtomic(
  supabase: SupabaseClient,
  entries: unknown[],
  clearEntries: unknown[],
  actorId: string,
): Promise<void> {
  const { error } = await supabase.rpc('save_kpi_entries', {
    p_entries: entries,
    p_clear_entries: clearEntries,
    p_actor_id: actorId,
  })
  if (error) throw error
}

export async function getKpiSubmissionSettings(supabase: SupabaseClient): Promise<KpiSubmissionSettings> {
  const { data, error } = await supabase
    .from('kpi_submission_settings')
    .select('tracking_start_fiscal_year, tracking_start_month, baseline_fiscal_year, baseline_month, deadline_day')
    .eq('id', true)
    .single()
  if (error) throw error
  return data as KpiSubmissionSettings
}

export async function getLatestKpiDefinitionVersions(
  supabase: SupabaseClient,
): Promise<KpiDefinitionVersion[]> {
  const { data, error } = await supabase
    .from('kpi_definition_versions')
    .select('*')
    .order('kpi_id')
    .order('version_no', { ascending: false })
  if (error) throw error
  const latest = new Map<number, KpiDefinitionVersion>()
  for (const row of (data ?? []) as KpiDefinitionVersion[]) {
    if (!latest.has(row.kpi_id)) latest.set(row.kpi_id, row)
  }
  return [...latest.values()]
}

export async function createKpiDefinitionVersion(
  supabase: SupabaseClient,
  definition: Pick<KpiDefinition, 'id' | 'code' | 'category' | 'sub_code' | 'name_th' | 'unit' | 'target_type' | 'target_val' | 'sort_order' | 'denominator'>,
  effectiveFrom: FiscalPeriod,
  actorId: string,
): Promise<KpiDefinitionVersion> {
  const { data: latest, error: latestError } = await supabase
    .from('kpi_definition_versions')
    .select('version_no')
    .eq('kpi_id', definition.id)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestError) throw latestError

  const { data, error } = await supabase
    .from('kpi_definition_versions')
    .insert({
      kpi_id: definition.id,
      version_no: (latest?.version_no ?? 0) + 1,
      code: definition.code,
      category: definition.category,
      sub_code: definition.sub_code,
      name_th: definition.name_th,
      unit: definition.unit,
      target_type: definition.target_type,
      target_val: definition.target_val,
      sort_order: definition.sort_order,
      denominator: definition.denominator,
      effective_from_fiscal_year: effectiveFrom.fiscalYear,
      effective_from_month: effectiveFrom.month,
      created_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as KpiDefinitionVersion
}

async function reconcilePeriod(supabase: SupabaseClient, options: ReconcileOptions): Promise<void> {
  const { error } = await supabase.rpc('reconcile_kpi_submission_period', {
    p_dept_id: options.deptId,
    p_fiscal_year: options.fiscalYear,
    p_month: options.month,
    p_actor_id: null,
  })
  if (error) throw error
}

async function reconcilePeriods(
  supabase: SupabaseClient,
  fiscalYear: number,
  departments: Department[],
): Promise<void> {
  if (departments.length === 0) return
  const { error } = await supabase.rpc('reconcile_kpi_submission_periods_bulk', {
    p_fiscal_year: fiscalYear,
    p_dept_ids: departments.map((department) => department.id),
  })
  if (error) throw error
}

async function reconcileDetailPeriod(
  supabase: SupabaseClient,
  options: ReconcileOptions,
): Promise<void> {
  await reconcilePeriod(supabase, options)
}

function periodFromSettings(settings: KpiSubmissionSettings, key: 'tracking' | 'baseline'): FiscalPeriod {
  return key === 'tracking'
    ? { fiscalYear: settings.tracking_start_fiscal_year, month: settings.tracking_start_month }
    : { fiscalYear: settings.baseline_fiscal_year, month: settings.baseline_month }
}

function makeFallbackPeriod(
  dept: Department,
  fiscalYear: number,
  month: number,
  settings: KpiSubmissionSettings,
  now: Date,
): KpiCompliancePeriod {
  const period: FiscalPeriod = { fiscalYear, month }
  const currentPeriod = (() => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      calendar: 'gregory',
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(now)
    const calendarYear = Number(parts.find((part) => part.type === 'year')?.value)
    const calendarMonth = Number(parts.find((part) => part.type === 'month')?.value)
    return {
      fiscalYear: calendarMonth >= 10 ? calendarYear + 544 : calendarYear + 543,
      month: calendarMonth,
    }
  })()
  const trackingStart = periodFromSettings(settings, 'tracking')
  const baseline = periodFromSettings(settings, 'baseline')
  const isBaseline = compareFiscalPeriods(period, baseline) === 0
  const deadline = getSubmissionDeadline(fiscalYear, month, settings.deadline_day)
  const status: SubmissionStatus = classifySubmissionStatus({
    period,
    currentPeriod,
    trackingStart,
    requiredCount: 1,
    filledCount: 0,
    baseline: isBaseline,
    now,
    deadlineDay: settings.deadline_day,
  })

  return {
    id: 0,
    dept_id: dept.id,
    dept_code: dept.code,
    dept_name: dept.name_th,
    fiscal_year: fiscalYear,
    month,
    deadline,
    required_count: 0,
    filled_count: 0,
    first_completed_at: null,
    first_completed_by: null,
    last_entry_at: null,
    last_entry_by: null,
    status,
    status_source: isBaseline ? 'baseline' : 'live',
    created_at: '',
    updated_at: '',
  }
}

function withDepartment(period: KpiSubmissionPeriod, dept: Department): KpiCompliancePeriod {
  return {
    ...period,
    dept_code: dept.code,
    dept_name: dept.name_th,
  }
}

function buildSummary(periods: KpiCompliancePeriod[]): KpiComplianceSummary {
  const summary: KpiComplianceSummary = {
    on_time: 0,
    missed: 0,
    pending: 0,
    not_open: 0,
    not_tracked: 0,
    not_applicable: 0,
    due_periods: 0,
    compliance_rate: null,
  }
  for (const period of periods) {
    summary[period.status] += 1
    if (period.status === 'on_time' || period.status === 'missed') summary.due_periods += 1
  }
  summary.compliance_rate = summary.due_periods === 0
    ? null
    : Math.round((summary.on_time / summary.due_periods) * 1000) / 10
  return summary
}

export async function getKpiCompliance(
  supabase: SupabaseClient,
  fiscalYear: number,
  options: { departments?: Department[]; deptCode?: string; status?: SubmissionStatus } = {},
): Promise<KpiComplianceResponse> {
  const [settings, departments] = await Promise.all([
    getKpiSubmissionSettings(supabase),
    options.departments ? Promise.resolve(options.departments) : getDepartments(supabase),
  ])
  const visibleDepartments = options.deptCode
    ? departments.filter((dept) => dept.code === options.deptCode)
    : departments
  const months = getFiscalMonths()
  const trackingStart = periodFromSettings(settings, 'tracking')
  const baseline = periodFromSettings(settings, 'baseline')
  const now = new Date()
  // Reconcile every fiscal month in one database round trip. The bulk RPC
  // still materializes all 12 snapshots, while only tracked statuses affect
  // compliance totals.
  await reconcilePeriods(supabase, fiscalYear, visibleDepartments)

  const departmentIds = visibleDepartments.map((dept) => dept.id)
  let query = supabase
    .from('kpi_submission_periods')
    .select('*')
    .eq('fiscal_year', fiscalYear)
    .order('deadline')
  if (departmentIds.length > 0) query = query.in('dept_id', departmentIds)
  const { data, error } = await query
  if (error) throw error
  const periodRows = (data ?? []) as KpiSubmissionPeriod[]
  const periodMap = new Map(periodRows.map((period) => [`${period.dept_id}|${period.month}`, period]))

  const allPeriods: KpiCompliancePeriod[] = []
  const rows = visibleDepartments.map((dept) => {
    const monthMap: Record<number, KpiCompliancePeriod> = {}
    for (const month of months) {
      const existing = periodMap.get(`${dept.id}|${month}`)
      const period = existing
        ? withDepartment(existing, dept)
        : makeFallbackPeriod(dept, fiscalYear, month, settings, now)
      monthMap[month] = period
      allPeriods.push(period)
    }
    return {
      dept_id: dept.id,
      dept_code: dept.code,
      dept_name: dept.name_th,
      months: monthMap,
    }
  })

  const summary = buildSummary(allPeriods)
  const lateItems = allPeriods
    .filter((period) => period.status === 'missed')
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.dept_code.localeCompare(b.dept_code))
  const filteredRows = options.status
    ? rows.filter((row) => Object.values(row.months).some((period) => period.status === options.status))
    : rows

  return {
    year: fiscalYear,
    months,
    tracking_start: trackingStart,
    baseline,
    settings,
    summary,
    periods: allPeriods,
    rows: filteredRows,
    late_items: lateItems,
  }
}

export async function getKpiComplianceDetail(
  supabase: SupabaseClient,
  options: { fiscalYear: number; month: number; deptId: number },
): Promise<KpiComplianceDetail> {
  await reconcileDetailPeriod(supabase, {
    deptId: options.deptId,
    fiscalYear: options.fiscalYear,
    month: options.month,
  })

  const [{ data: department, error: departmentError }, { data: period, error: periodError }] = await Promise.all([
    supabase.from('departments').select('id, code, name_th').eq('id', options.deptId).single(),
    supabase.from('kpi_submission_periods').select('*')
      .eq('dept_id', options.deptId)
      .eq('fiscal_year', options.fiscalYear)
      .eq('month', options.month)
      .single(),
  ])
  if (departmentError) throw departmentError
  if (periodError) throw periodError

  const periodRow = period as KpiSubmissionPeriod
  const { data: requirementRows, error: requirementError } = await supabase
    .from('kpi_submission_requirements')
    .select('*')
    .eq('period_id', periodRow.id)
    .order('sort_order')
    .order('kpi_id')
  if (requirementError) throw requirementError

  const requirements = (requirementRows ?? []) as KpiSubmissionRequirement[]
  const kpiIds = requirements.map((requirement) => requirement.kpi_id)
  let entries: KpiEntry[] = []
  if (kpiIds.length > 0) {
    const { data, error } = await supabase
      .from('kpi_entries')
      .select('*')
      .eq('dept_id', options.deptId)
      .eq('fiscal_year', options.fiscalYear)
      .eq('month', options.month)
      .in('kpi_id', kpiIds)
    if (error) throw error
    entries = (data ?? []) as KpiEntry[]
  }
  const entryMap = new Map(entries.map((entry) => [entry.kpi_id, entry]))
  const detailedRequirements = requirements.map((requirement) => {
    const entry = entryMap.get(requirement.kpi_id)
    const filled = isKpiEntryComplete(entry?.numerator, entry?.denominator, requirement)
    return {
      ...requirement,
      filled,
      numerator: entry?.numerator ?? null,
      denominator_value: entry?.denominator ?? null,
      result_pct: entry?.result_pct ?? null,
      updated_at: entry?.updated_at ?? null,
    }
  })
  return {
    department: department as Pick<Department, 'id' | 'code' | 'name_th'>,
    period: periodRow,
    requirements: detailedRequirements,
    missing: detailedRequirements.filter((requirement) => !requirement.filled),
    submitted_after_deadline_at: getSubmittedAfterDeadlineAt({
      status: periodRow.status,
      deadline: periodRow.deadline,
      firstCompletedAt: periodRow.first_completed_at,
      lastEntryAt: periodRow.last_entry_at,
    }),
  }
}

export function getComplianceStatusLabel(status: SubmissionStatus): string {
  return getSubmissionStatusLabel(status)
}
