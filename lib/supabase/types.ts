export type Role = 'admin' | 'staff' | 'editor' | 'viewer'
export type UserStatus = 'active' | 'inactive' | 'pending'

export interface Profile {
  id: string
  name: string
  role: Role
  dept: string | null
  status: UserStatus
  created_at: string
}

export interface Category {
  id: string
  th: string
  en: string
  color: string
  icon: string
  sort_order: number
  active: boolean
  created_at: string
}

export interface Test {
  id: number
  code: string
  cgd: string | null
  loinc: string | null
  th: string
  en: string
  category_id: string | null
  tube: string | null
  volume: string | null
  method: string | null
  tat: string | null
  tat_hours: number | null
  service: string | null
  price: number | null
  ref: string | null
  stability: string | null
  reject: string | null
  priority: string
  popular: boolean
  active: boolean
  created_at: string
  updated_at: string
}

export interface Document {
  id: number
  cat: string
  name: string
  code: string
  rev: string | null
  date: string | null
  size_mb: number | null
  public: boolean
  owner: string | null
  storage_path: string | null
  created_at: string
}

export interface News {
  id: number
  title: string
  excerpt: string | null
  body: string | null
  category: string | null
  cat: string | null
  author: string | null
  published: boolean
  is_new: boolean
  new_until: string | null
  image_path: string | null
  pdf_path: string | null
  views: number
  created_at: string
  updated_at: string
}

export interface Risk {
  id: number
  name: string
  likelihood: number
  impact: number
  level: 'low' | 'medium' | 'high'
  owner: string | null
  status: 'open' | 'mitigating' | 'monitoring' | 'closed'
  created_at: string
}

export interface Contract {
  id: number
  vendor: string
  product: string
  total: number
  start_date: string | null
  end_date: string | null
  unit: string | null
  status: 'active' | 'expired' | 'cancelled' | 'pending'
  created_at: string
  used?: number
}

export interface ContractUsage {
  id: number
  contract_id: number
  amount: number
  note: string | null
  recorded_by: string | null
  usage_date: string | null
  created_at: string
}

export interface RejectionLog {
  id: number
  ref_no: string
  test_code: string | null
  reason: string | null
  dept: string | null
  logged_by: string | null
  severity: 'low' | 'medium' | 'high' | null
  logged_at: string
}

export interface AuditLog {
  id: number
  action: string
  user_id: string | null
  target: string | null
  detail: string | null
  created_at: string
}

export interface TATImportBatch {
  id: number
  filename: string
  row_count: number
  fiscal_year: number
  month: number
  imported_by: string | null
  created_at: string
}

export interface TATEntry {
  id: number
  batch_id: number | null
  lab_number: string | null
  test_code: string | null
  test_name: string | null
  dept_code: string | null
  received_at: string
  resulted_at: string
  tat_minutes: number
  fiscal_year: number
  month: number
}

export interface WorkloadDepartment {
  id: number
  name: string
  code: string
  color: string
}

export interface WorkloadTest {
  id: number
  dept_id: number
  ephis_code: string
  test_name: string
  price: number | null
}

export interface WorkloadEntry {
  id: number
  test_id: number
  fiscal_year: number
  month: number
  in_time_count: number
  total_count: number
}

export interface Department {
  id: number
  code: string
  name_th: string
  is_active: boolean
}

export interface KpiDefinition {
  id: number
  code: string
  category: string
  sub_code: string | null
  name_th: string
  unit: string | null
  target_type: 'gte' | 'lte' | 'eq'
  target_val: number
  sort_order: number
}

export interface KpiEntry {
  id: number
  dept_id: number
  kpi_id: number
  fiscal_year: number
  month: number
  numerator: number | null
  denominator: number | null
  result_pct: number | null
}

export interface VwKpiDashboardRow {
  dept_code: string
  dept_name: string
  kpi_code: string
  category: string
  sub_code: string | null
  kpi_name: string
  target_type: 'gte' | 'lte' | 'eq'
  target_val: number
  unit: string | null
  fiscal_year: number
  month: number
  numerator: number | null
  denominator: number | null
  result_pct: number | null
  is_pass: boolean | null
}
