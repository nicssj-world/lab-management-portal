import type { ItDepartmentCode } from './domain'
import type { FindingStatus, RoundStatus, SampleResult, SamplingRunStatus } from './status'

export type VerificationFinding = {
  id: string
  sample_id: string
  round_id: string
  transfer_point: 'lis_to_his' | 'source_to_lis'
  description: string
  severity: 'low' | 'medium' | 'high'
  status: FindingStatus
  resolution_note: string | null
  opened_at: string
  closed_at: string | null
}

export type VerificationSample = {
  id: string
  round_id: string
  sampling_run_id: string
  department_id: number
  ln: string
  source_month: number | null
  source_lab_section: string | null
  test_name: string | null
  first_spcm_at: string | null
  last_result_at: string | null
  source_record_count: number
  sampling_method: 'automatic' | 'legacy_manual'
  lis_to_his: SampleResult
  source_to_lis: SampleResult
  remark: string
  sample_state: 'active' | 'void'
  updated_at: string
  findings: VerificationFinding[]
}

export type VerificationDepartmentSummary = {
  departmentId: number
  code: ItDepartmentCode
  name: string
  roundId: string | null
  roundStatus: RoundStatus | null
  samplingStatus: SamplingRunStatus | null
  target: number
  sampled: number
  completed: number
  incomplete: number
  openFindings: number
  assigneeId: string | null
  assigneeName: string | null
  warning: string | null
  ready: boolean
}

export type VerificationSummary = {
  schemaReady: boolean
  year: number
  quarter: number
  departments: VerificationDepartmentSummary[]
  totals: {
    target: number
    sampled: number
    completed: number
    openFindings: number
    readyDepartments: number
  }
  warnings: string[]
}

export type VerificationRoundDetail = {
  schemaReady: boolean
  round: {
    id: string
    year: number
    quarter: number
    departmentId: number
    code: ItDepartmentCode
    name: string
    status: RoundStatus
    submittedAt: string | null
    reviewedAt: string | null
    reviewNote: string | null
  } | null
  samples: VerificationSample[]
  assigneeName: string | null
  warnings: string[]
}
