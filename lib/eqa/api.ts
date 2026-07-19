import { supabaseAdmin } from '@/lib/supabase/admin'
import type { z } from 'zod'
import type { providerSchema, programSchema, programTestSchema, roundSchema, resultSchema } from './schemas'

type ProviderInput = z.infer<typeof providerSchema>
type ProgramInput = z.infer<typeof programSchema>
type ProgramTestInput = z.infer<typeof programTestSchema>
type RoundInput = z.infer<typeof roundSchema>
type ResultInput = z.infer<typeof resultSchema>

export const providerPayload = (input: ProviderInput, actorId: string) => ({
  name: input.name, short_name: input.shortName, contact_name: input.contactName,
  contact_phone: input.contactPhone, contact_email: input.contactEmail, active: input.active,
  remark: input.remark, updated_at: new Date().toISOString(), updated_by: actorId,
})
export const programPayload = (input: ProgramInput, actorId: string) => ({
  provider_id: input.providerId, fiscal_year_be: input.fiscalYearBe, program_code: input.programCode,
  name: input.name, discipline: input.discipline, program_type: input.programType, active: input.active,
  remark: input.remark, updated_at: new Date().toISOString(), updated_by: actorId,
})
export const programTestPayload = (input: ProgramTestInput) => ({
  program_id: input.programId, test_id: input.testId, manual_test_name: input.manualTestName,
  test_name_snapshot: input.testNameSnapshot, analyte_code: input.analyteCode, active: input.active,
})
export const roundPayload = (input: RoundInput, actorId: string) => ({
  program_id: input.programId, round_code: input.roundCode, expected_receipt_on: input.expectedReceiptOn,
  received_on: input.receivedOn, submission_due_on: input.submissionDueOn, submitted_on: input.submittedOn,
  report_received_on: input.reportReceivedOn, status: input.status, note: input.note,
  updated_at: new Date().toISOString(), updated_by: actorId,
})
export const resultPayload = (roundId: string, input: ResultInput, actorId: string) => ({
  round_id: roundId, program_test_id: input.programTestId, sample_code: input.sampleCode ?? '',
  reported_value: input.reportedValue, target_value: input.targetValue, z_score: input.zScore,
  sdi: input.sdi, score: input.score, outcome: input.outcome, reason: input.reason, note: input.note,
  updated_at: new Date().toISOString(), updated_by: actorId,
})

export async function syncProgramOwners(programId: string, input: ProgramInput) {
  const ids = Array.from(new Set([...input.ownerIds, ...(input.primaryOwnerId ? [input.primaryOwnerId] : [])]))
  const { error: deleteError } = await supabaseAdmin.from('eqa_program_owners').delete().eq('program_id', programId)
  if (deleteError) throw deleteError
  if (!ids.length) return
  const { error } = await supabaseAdmin.from('eqa_program_owners').insert(ids.map(userId => ({
    program_id: programId, user_id: userId, owner_role: userId === input.primaryOwnerId ? 'primary' : 'collaborator',
  })))
  if (error) throw error
}

