import type { SupabaseClient } from '@supabase/supabase-js'

export interface Equipment {
  id: string
  item_no: number | null
  cbh_code: string | null
  cbh_code_pending: boolean
  hospital_asset_no: string | null
  hospital_asset_no_pending: boolean
  department: string
  owner: string | null
  owner_status: string | null
  risk_level: 'High' | 'Medium' | 'Low' | null
  classification: string | null
  equipment_type: string
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  vendor: string | null
  purchase_date: string | null
  warranty_exp: string | null
  purchase_price: number | null
  status: 'Active' | 'Inactive' | 'ชำรุด' | 'มาใหม่' | 'ย้าย' | 'สูญหาย'
  needs_calibration: boolean
  responsible_user_id: string | null
  responsible_person: string | null
  purpose: string | null
  remark: string | null
  photo_url: string | null
  method_validation_url: string | null
  method_correlation_url: string | null
  manual_url: string | null
  pm_cal_data: {
    tech_group: string | null
    times_pm: number | null
    times_cal: number | null
    plan: Record<string, { pm: boolean; cal: boolean }>
    last_pm_date: string | null
    last_cal_date: string | null
    certificate_no: string | null
    error_value: string | null
    uncertainty: string | null
    cal_result: string | null
    remark: string | null
    certificate_file_url: string | null
  } | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface EquipmentFilters {
  search?: string
  department?: string
  status?: string
  risk_level?: string
  needs_calibration?: boolean
  pending_reg?: boolean
}

export interface EquipmentPageOptions extends EquipmentFilters {
  page?: number
  pageSize?: number
  sortDir?: 'asc' | 'desc'
}

export interface EquipmentPageResult {
  items: Equipment[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

export interface EquipmentSummaryCounts {
  active: number
  highRisk: number
  warrantyAlert: number
  needsCalibration: number
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

function normalizeSearch(value: string) {
  return value.trim().replace(/[(),]/g, ' ')
}

function applyEquipmentFilters(query: any, filters: EquipmentFilters) {
  const search = normalizeSearch(filters.search ?? '')

  if (search) {
    const pattern = `%${escapeLike(search)}%`
    query = query.or([
      `equipment_type.ilike.${pattern}`,
      `cbh_code.ilike.${pattern}`,
      `hospital_asset_no.ilike.${pattern}`,
      `serial_number.ilike.${pattern}`,
      `manufacturer.ilike.${pattern}`,
      `model.ilike.${pattern}`,
      `responsible_person.ilike.${pattern}`,
    ].join(','))
  }
  if (filters.department) query = query.eq('department', filters.department)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.risk_level) query = query.eq('risk_level', filters.risk_level)
  if (filters.needs_calibration !== undefined)
    query = query.eq('needs_calibration', filters.needs_calibration)
  if (filters.pending_reg) query = query.or('cbh_code_pending.eq.true,hospital_asset_no_pending.eq.true')

  return query
}

function isWarrantyAlert(exp: string | null) {
  if (!exp) return false
  const days = (new Date(exp).getTime() - Date.now()) / 86400000
  return days < 90
}

function summarizeEquipmentRows(rows: Array<Pick<Equipment, 'status' | 'risk_level' | 'needs_calibration' | 'warranty_exp'>>): EquipmentSummaryCounts {
  return rows.reduce<EquipmentSummaryCounts>((acc, row) => {
    if (row.status === 'Active') acc.active += 1
    if (row.risk_level === 'High') acc.highRisk += 1
    if (row.needs_calibration) acc.needsCalibration += 1
    if (isWarrantyAlert(row.warranty_exp)) acc.warrantyAlert += 1
    return acc
  }, { active: 0, highRisk: 0, warrantyAlert: 0, needsCalibration: 0 })
}

export async function getEquipment(
  supabase: SupabaseClient,
  filters: EquipmentFilters = {}
): Promise<Equipment[]> {
  let query = supabase
    .from('equipment')
    .select('*')
    .order('equipment_type', { ascending: true })

  query = applyEquipmentFilters(query, filters)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Equipment[]
}

export async function getEquipmentPage(
  supabase: SupabaseClient,
  options: EquipmentPageOptions = {}
): Promise<EquipmentPageResult> {
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(Math.max(1, options.pageSize ?? 50), 100)
  const from = (page - 1) * pageSize

  let query: any = supabase
    .from('equipment')
    .select('*', { count: 'exact' })
    .order('equipment_type', { ascending: options.sortDir !== 'desc' })
    .order('item_no', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  query = applyEquipmentFilters(query, options)
  query = query.range(from, from + pageSize - 1)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  const total = count ?? 0
  return {
    items: (data ?? []) as Equipment[],
    count: total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getEquipmentSummaryCounts(
  supabase: SupabaseClient,
  filters: EquipmentFilters = {}
): Promise<EquipmentSummaryCounts> {
  let query: any = supabase
    .from('equipment')
    .select('status, risk_level, needs_calibration, warranty_exp')

  query = applyEquipmentFilters(query, filters)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return summarizeEquipmentRows((data ?? []) as Array<Pick<Equipment, 'status' | 'risk_level' | 'needs_calibration' | 'warranty_exp'>>)
}

export async function getEquipmentDepartments(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('equipment')
    .select('department')
    .order('department')
  if (error) throw new Error(error.message)
  const unique = Array.from(new Set((data ?? []).map((r: { department: string }) => r.department)))
  return unique
}

export async function getEquipmentStatusCounts(supabase: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('equipment')
    .select('status')
  if (error) throw new Error(error.message)
  const counts: Record<string, number> = { '': data?.length ?? 0 }
  for (const row of data ?? []) {
    const status = (row as { status: string | null }).status ?? ''
    counts[status] = (counts[status] ?? 0) + 1
  }
  return counts
}

export async function getEquipmentLastUpdated(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from('equipment')
    .select('updated_at, created_at')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.updated_at ?? data?.created_at ?? null
}
