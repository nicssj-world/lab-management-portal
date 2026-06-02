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
}

export async function getEquipment(
  supabase: SupabaseClient,
  filters: EquipmentFilters = {}
): Promise<Equipment[]> {
  let query = supabase
    .from('equipment')
    .select('*')
    .order('equipment_type', { ascending: true })

  if (filters.search) {
    query = query.or(
      `equipment_type.ilike.%${filters.search}%,cbh_code.ilike.%${filters.search}%,hospital_asset_no.ilike.%${filters.search}%,serial_number.ilike.%${filters.search}%,manufacturer.ilike.%${filters.search}%,model.ilike.%${filters.search}%,responsible_person.ilike.%${filters.search}%`
    )
  }
  if (filters.department) query = query.eq('department', filters.department)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.risk_level) query = query.eq('risk_level', filters.risk_level)
  if (filters.needs_calibration !== undefined)
    query = query.eq('needs_calibration', filters.needs_calibration)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Equipment[]
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
