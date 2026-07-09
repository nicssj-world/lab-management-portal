export type Role = 'Admin' | 'Manager' | 'Medical Technologist' | 'Assistant' | 'Document Controller' | 'Medical Science Technician'

export interface ManualSection {
  id: string
  body_html_th: string
  body_html_en: string
  updated_at: string
  updated_by: string | null
}
export type UserStatus = 'active' | 'inactive' | 'pending'

export interface Profile {
  id: string
  name: string
  role: Role
  dept: string | null
  phone: string | null
  status: UserStatus
  avatar_url: string | null
  official_photo_url?: string | null
  ephis_id?: string | null
  document_position: string | null
  signature_url: string | null
  signature_updated_at: string | null
  signature_updated_by: string | null
  created_at: string
  // personnel-record fields (added by scripts/personnel-module.sql)
  position_title?: string | null
  unit?: string | null
  employment_type?: string | null
  start_date?: string | null
  education?: string | null
  mt_license_no?: string | null
  mt_license_expiry?: string | null
}

// ── MT-CBH Staff / Personnel module (ISO 15189 clause 6.2) ──
export interface StaffCertification {
  id: string
  profile_id: string
  cert_type: string | null
  cert_name: string
  cert_no: string | null
  issuer: string | null
  issue_date: string | null
  expiry_date: string | null
  file_url: string | null
  status: 'active' | 'expired' | 'revoked'
  remark: string | null
  created_at: string
  created_by: string | null
  deleted_at: string | null
}

export interface StaffTraining {
  id: string
  profile_id: string
  topic: string
  training_date: string | null
  hours: number | null
  provider: string | null
  location: string | null
  training_type: 'internal' | 'external' | 'CME' | 'CPD' | null
  cpd_credits: number | null
  evidence_url: string | null
  notes: string | null
  created_at: string
  created_by: string | null
  deleted_at: string | null
}

export interface StaffCompetency {
  id: string
  profile_id: string
  assessment_type: 'initial' | 'periodic'
  area: string | null
  test_id: number | null
  assessor_id: string | null
  assessment_date: string | null
  next_due_date: string | null
  score_knowledge: number | null
  score_safety: number | null
  score_practical: number | null
  result: 'pass' | 'fail' | null
  evidence_url: string | null
  notes: string | null
  created_at: string
  created_by: string | null
  deleted_at: string | null
  // peer-assessment sign-off (Phase 2)
  assessor_signoff?: boolean
  assessor_signoff_at?: string | null
  assessee_ack?: boolean
  assessee_ack_at?: string | null
}

export interface StaffJd {
  id: string
  profile_id: string
  jd_code: string | null
  position_title: string | null
  version: string
  content: string | null
  file_url: string | null
  effective_date: string | null
  approver_id: string | null
  approver_name: string | null
  approver_position?: string | null
  status: 'Draft' | 'Active' | 'Obsolete'
  created_at: string
  created_by: string | null
  updated_at: string
  deleted_at: string | null
}

export interface StaffJdRevision {
  id: string
  jd_id: string
  version: string
  content: string | null
  file_url: string | null
  effective_date: string | null
  approver_name: string | null
  approver_position?: string | null
  revision_note: string | null
  revised_by: string | null
  created_at: string
}

export interface StaffTrainingPlan {
  id: string
  profile_id: string
  year: number
  topic: string
  source: string | null
  status: 'planned' | 'done' | 'cancelled'
  training_id: string | null
  notes: string | null
  created_at: string
  created_by: string | null
  deleted_at: string | null
}

export interface OrientationItem { key: string; label: string; done: boolean }
export interface StaffOrientation {
  id: string
  profile_id: string
  items: OrientationItem[]
  completed_by: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface OrgChartNode {
  id: string
  parent_id: string | null
  title: string
  person_name: string | null
  profile_id: string | null
  photo_url: string | null
  phone: string | null
  node_type: 'leadership' | 'position' | 'unit'
  is_linkable: boolean
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface StaffAuthorization {
  id: string
  profile_id: string
  test_id: number | null
  category: string | null
  role_type: 'performer' | 'reporter' | 'approver' | 'authorized_signatory' | 'deputy'
  competency_id: string | null
  authorized_date: string | null
  authorized_by: string | null
  status: 'active' | 'revoked'
  revoked_date: string | null
  notes: string | null
  created_at: string
  created_by: string | null
  deleted_at: string | null
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
  type: 'QP' | 'WI' | 'Form' | 'Policy' | 'Manual' | 'Record' | 'Reference' | 'Card file' | 'Others'
  department: string | null
  revision: string
  status: 'Draft' | 'Review' | 'Approved' | 'Published' | 'Obsolete'
  visibility: 'Public' | 'Internal'
  owner_id: string | null
  owner_name: string | null
  description: string | null
  tags: string[] | null
  file_url: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  source_pdf_url: string | null
  source_pdf_name: string | null
  source_pdf_size: number | null
  source_pdf_mime_type: string | null
  word_url: string | null
  word_name: string | null
  word_size: number | null
  edit_date: string | null
  effective_date: string | null
  approved_at: string | null
  published_at: string | null
  approved_by_id: string | null
  published_by_id: string | null
  reviewer_id: string | null
  approver_id: string | null
  audience_text: string | null
  cover_template_version: string | null
  cover_generated_at: string | null
  cover_metadata: Record<string, unknown> | null
  imported_current_at: string | null
  imported_current_by: string | null
  imported_current_note: string | null
  legacy_cover_included: boolean
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
  revised_by: string | null
  approved_by: string | null
  file_url: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  source_pdf_url: string | null
  source_pdf_name: string | null
  source_pdf_size: number | null
  source_pdf_mime_type: string | null
  word_url: string | null
  word_name: string | null
  word_size: number | null
  edit_date: string | null
  effective_date: string | null
  expiry_date: string | null
  approved_at: string | null
  published_at: string | null
  approved_by_id: string | null
  published_by_id: string | null
  reviewer_id: string | null
  approver_id: string | null
  audience_text: string | null
  cover_template_version: string | null
  cover_generated_at: string | null
  cover_metadata: Record<string, unknown> | null
  imported_current_at: string | null
  imported_current_by: string | null
  imported_current_note: string | null
  legacy_cover_included: boolean | null
  history_source?: string | null
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
  usage_month: string | null
  created_at: string
}

export interface DocumentRevisionDraft {
  id: string
  document_id: string
  revision: string
  title: string
  type: Document['type']
  department: string | null
  description: string | null
  status: Document['status']
  visibility: Document['visibility']
  owner_name: string | null
  reviewer_name: string | null
  approver_name: string | null
  reviewer_id: string | null
  approver_id: string | null
  audience_text: string | null
  file_url: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  source_pdf_url: string | null
  source_pdf_name: string | null
  source_pdf_size: number | null
  source_pdf_mime_type: string | null
  word_url: string | null
  word_name: string | null
  word_size: number | null
  edit_date: string | null
  effective_date: string | null
  expiry_date: string | null
  approved_at: string | null
  published_at: string | null
  approved_by_id: string | null
  published_by_id: string | null
  cover_template_version: string | null
  cover_generated_at: string | null
  cover_metadata: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  updated_at: string
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
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
