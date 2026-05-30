export type Role = 'Admin' | 'Manager' | 'Medical Technologist' | 'Assistant' | 'Document Controller' | 'Medical Science Technician'
export type UserStatus = 'active' | 'inactive' | 'pending'

export interface Profile {
  id: string
  name: string
  role: Role
  dept: string | null
  status: UserStatus
  avatar_url: string | null
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
  // extended columns (added by migration)
  lis_code?: string | null
  short_name?: string | null
  description?: string | null
  department?: string | null
  instrument?: string | null
  methodology_note?: string | null
  tat_minutes?: string | null
  urgent_tat_minutes?: string | null
  available_24hr?: boolean
  tube_color?: string | null
  transport_condition?: string | null
  specimen_note?: string | null
  created_by?: string | null
  updated_by?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  contact_note?: string | null
  ref_note?: string | null
  contact_staff?: boolean
  related_doc_ids?: string[] | null
}

export interface TestReferenceRange {
  id: number
  test_id: number
  gender: 'M' | 'F' | 'All'
  min_age: number | null
  max_age: number | null
  lower_limit: number | null
  upper_limit: number | null
  unit: string | null
  note: string | null
  sort_order: number
}

export interface TestDocument {
  id: number
  test_id: number
  doc_type: 'QP' | 'WI' | 'Form' | 'Other'
  name: string
  storage_path: string
  uploaded_by: string | null
  created_at: string
}

export interface TestDetail {
  test: Test
  referenceRanges: TestReferenceRange[]
  documents: TestDocument[]
}

export interface Document {
  id: string
  document_code: string
  title: string
  type: 'QP' | 'WI' | 'Form' | 'Policy' | 'Manual' | 'Record' | 'Others'
  department: string | null
  revision: string
  status: 'Draft' | 'Review' | 'Approved' | 'Published' | 'Obsolete'
  visibility: 'Public' | 'Internal'
  owner_id: string | null
  owner_name: string | null
  description: string | null
  tags: string[] | null
  file_url: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  effective_date: string | null
  expiry_date: string | null
  obsolete_date: string | null
  obsolete_reason: string | null
  reviewer_name: string | null
  approver_name: string | null
  created_at: string
  updated_at: string
}

export interface DocumentRevision {
  id: string
  document_id: string
  revision_number: string
  revision_note: string | null
  file_url: string
  file_name: string
  uploaded_by: string | null
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
  risk_no?: string | null
  external_no?: string | null
  event_type?: string | null
  event_date?: string | null
  event_time?: string | null
  reporter_name?: string | null
  reporter_position?: string | null
  department_found?: string | null
  department_target?: string | null
  risk_type?: string | null
  event_main_category?: string | null
  event_sub_category?: string | null
  event_category?: string | null
  event_detail?: string | null
  impact_summary?: string | null
  immediate_correction?: string | null
  evidence_note?: string | null
  severity_level?: string | null
  ior_status?: string | null
  recorded_date?: string | null
  requires_rca?: boolean | null
  review_status?: 'pending' | 'reviewed' | 'rca_required' | 'action_plan' | 'follow_up' | 'closed' | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  review_note?: string | null
  rca_method?: string | null
  root_cause?: string | null
  rca_factors?: Record<string, unknown> | null
  residual_likelihood?: number | null
  residual_impact?: number | null
  residual_score?: number | null
  residual_level?: 'low' | 'medium' | 'high' | null
  residual_assessed_at?: string | null
  residual_assessed_by?: string | null
  risk_accepted_by?: string | null
  risk_accepted_at?: string | null
  due_date?: string | null
  follow_up_date?: string | null
  effectiveness_result?: string | null
  closed_by?: string | null
  closed_at?: string | null
  created_by?: string | null
  updated_at?: string | null
}

export interface RiskAction {
  id: number
  risk_id: number
  action_type: 'correction' | 'corrective' | 'preventive' | 'follow_up'
  description: string
  owner: string | null
  due_date: string | null
  status: 'open' | 'in_progress' | 'done'
  completed_at: string | null
  evidence: string | null
  effectiveness_note: string | null
  follow_up_date: string | null
  followed_by: string | null
  result: string | null
  is_effective: boolean | null
  next_follow_up_date: string | null
  created_at: string
  updated_at: string
}

export interface Contract {
  id: number
  contract_number: string | null
  vendor: string
  product: string
  total: number
  start_date: string | null
  end_date: string | null
  unit: string | null
  department: string | null
  status: 'active' | 'expired' | 'cancelled' | 'pending'
  file_url: string | null
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
  denominator: string | null
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

export interface KpiSatisfaction {
  id: number
  metric_code: string
  metric_name: string
  fiscal_year: number
  value: number | null
  target_val: number
  created_at: string
}

export interface AnnualKpiRow {
  kpi_code: string
  kpi_name: string
  category: string
  sub_code: string | null
  target_type: 'gte' | 'lte' | 'eq'
  target_val: number
  unit: string | null
  denominator_label: string | null
  months: Record<number, { numerator: number | null; denominator: number | null; result_pct: number | null; is_pass: boolean | null }>
}
