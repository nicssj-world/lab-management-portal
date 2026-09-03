import { supabaseAdmin } from '@/lib/supabase/admin'
import { departmentByCode } from './domain'
import { canManageVerification, canReviewVerification, type ItVerificationActor } from './guard'

export type VerificationRoundRow = {
  id: string
  year: number
  quarter: number
  department_id: number
  status: 'draft' | 'submitted' | 'reviewed'
}

export async function getVerificationRound(roundId: string): Promise<VerificationRoundRow | null> {
  const { data, error } = await supabaseAdmin
    .from('it_verification_rounds')
    .select('id, year, quarter, department_id, status')
    .eq('id', roundId)
    .maybeSingle()
  if (error) throw error
  return data as VerificationRoundRow | null
}

export async function canEditVerificationRound(actor: ItVerificationActor, round: VerificationRoundRow): Promise<boolean> {
  if (round.status === 'reviewed') return false
  if (canManageVerification(actor)) return true

  const department = departmentByCode(actor.departmentCode)
  if (!department || department.id !== round.department_id) return false
  const { data, error } = await supabaseAdmin
    .from('it_verification_assignees')
    .select('id')
    .eq('round_id', round.id)
    .eq('department_id', round.department_id)
    .eq('profile_id', actor.id)
    .maybeSingle()
  if (error) throw error
  return Boolean(data?.id)
}

export async function canViewVerificationRound(actor: ItVerificationActor, round: VerificationRoundRow): Promise<boolean> {
  if (canManageVerification(actor) || canReviewVerification(actor)) return true
  const department = departmentByCode(actor.departmentCode)
  if (!department || department.id !== round.department_id) return false
  const { data, error } = await supabaseAdmin
    .from('it_verification_assignees')
    .select('id')
    .eq('round_id', round.id)
    .eq('department_id', round.department_id)
    .eq('profile_id', actor.id)
    .maybeSingle()
  if (error) throw error
  return Boolean(data?.id)
}

export async function hasVerificationSchema() {
  const { error } = await supabaseAdmin.from('it_verification_rounds').select('id').limit(1)
  return !error
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
