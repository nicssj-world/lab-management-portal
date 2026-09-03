import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPermissionsWithItOverride, type PermLevel } from '@/lib/permissions'
import { isAdminRole, normalizeRole } from '@/lib/roles'
import { departmentCodeForProfileDepartment, type ItDepartmentCode } from './domain'

export const VERIFICATION_RESOURCE = 'ทวนสอบการส่งผ่านข้อมูล HIS & LIS'

export type ItVerificationActor = {
  id: string
  role: string
  name: string | null
  dept: string | null
  deptRole: string | null
  departmentCode: ItDepartmentCode | null
  itCommittee: boolean
}

export type VerificationGuard = {
  actor: ItVerificationActor
  permission: PermLevel
}

export async function getItVerificationActor(): Promise<ItVerificationActor | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: itEditor }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, role, name, dept, dept_role, status, deleted_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabaseAdmin.from('it_editors').select('user_id').eq('user_id', user.id).maybeSingle(),
  ])
  if (!profile?.id || !profile.role || profile.status !== 'active' || profile.deleted_at) return null

  return {
    id: profile.id,
    role: normalizeRole(profile.role),
    name: profile.name ?? null,
    dept: profile.dept ?? null,
    deptRole: profile.dept_role ?? null,
    departmentCode: departmentCodeForProfileDepartment(profile.dept),
    itCommittee: Boolean(itEditor?.user_id),
  }
}

export function canReviewVerification(actor: Pick<ItVerificationActor, 'role' | 'deptRole' | 'itCommittee'>): boolean {
  return isAdminRole(actor.role) || actor.deptRole === 'group_lead' || actor.itCommittee
}

export function canViewAllVerification(actor: Pick<ItVerificationActor, 'role' | 'deptRole' | 'itCommittee'>): boolean {
  return canReviewVerification(actor) || normalizeRole(actor.role) === 'Manager'
}

export function canManageVerification(actor: Pick<ItVerificationActor, 'role' | 'itCommittee'>): boolean {
  // Managers coordinate the sampling/settings workflow; IT committee members
  // retain the explicit per-user override used by the existing IT module.
  return isAdminRole(actor.role) || normalizeRole(actor.role) === 'Manager' || actor.itCommittee
}

export function canViewVerification(permission: PermLevel): boolean {
  return permission === 'view' || permission === 'edit'
}

export async function requireItVerification(level: 'view' | 'edit' = 'view'): Promise<VerificationGuard | { error: NextResponse }> {
  const actor = await getItVerificationActor()
  if (!actor) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const permissions = await getPermissionsWithItOverride(actor.role, actor.id)
  const permission = permissions[VERIFICATION_RESOURCE] ?? 'none'
  if (!canViewVerification(permission) || (level === 'edit' && permission !== 'edit')) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { actor, permission }
}

export async function auditVerification(action: string, actorId: string, target: string, detail: string) {
  const { error } = await supabaseAdmin.from('audit_log').insert({
    action: `it_verification.${action}`,
    user_id: actorId,
    target,
    detail: detail.slice(0, 1000),
  })
  if (error) console.error('IT verification audit failed:', error.message)
}

export function jsonDatabaseError(error: { message?: string } | null | undefined) {
  return NextResponse.json({ error: error?.message ?? 'ไม่สามารถเชื่อมต่อข้อมูลการทวนสอบได้' }, { status: 500 })
}
