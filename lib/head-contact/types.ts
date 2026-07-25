import type { DeptRole } from '@/lib/supabase/types'
import type { HeadContactCategory, HeadContactStatus } from './constants'

export type HeadContactActor = {
  id: string
  role: string
  name: string | null
  dept_role: DeptRole | null
}

export type HeadContactSubmissionInput = {
  sender_name: string
  contact_channel: string
  service_unit_id: string
  service_unit_name: string
  other_service_unit: string
  category: HeadContactCategory
  detail: string
  wants_reply: boolean
}

export type NormalizedHeadContactSubmission = {
  sender_name: string | null
  contact_channel: string | null
  service_unit_id: string | null
  service_unit_snapshot: string
  category: HeadContactCategory
  detail: string
  wants_reply: boolean
}

export type HeadContactValidationIssue = {
  field: keyof HeadContactSubmissionInput
  message: string
}

export type HeadContactValidationResult =
  | { ok: true; row: NormalizedHeadContactSubmission }
  | { ok: false; issues: HeadContactValidationIssue[] }

export type HeadContactServiceUnit = {
  id: string
  name: string
  display_order: number
  is_active: boolean
}

export type PublicHeadContactFormState =
  | { available: true; units: HeadContactServiceUnit[] }
  | { available: false; reason: 'closed'; units: HeadContactServiceUnit[] }

export type HeadContactSubmission = NormalizedHeadContactSubmission & {
  id: string
  status: HeadContactStatus
  action_note: string | null
  contacted_at: string | null
  contact_note: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
  closed_at: string | null
  closed_by: string | null
}

export type HeadContactFormSettings = {
  public_token: string
  is_open: boolean
  updated_at: string
}
