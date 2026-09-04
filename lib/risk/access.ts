import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { RISK_RESOURCE } from '@/lib/permission-resources'
import { canCloseIncidentActor, canCloseRegisterActor, canManageIncidentActor, canReviewRiskActor } from './access-policy'

export { RISK_RESOURCE }

export type RiskActor = {
  id: string
  role: string
  name: string | null
  isActive?: boolean
  isRiskTeamMember?: boolean
}

async function getAuthenticatedRiskActor(): Promise<RiskActor | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const [{ data: profile }, { data: teamMember, error: teamMemberError }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, role, name, status, deleted_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('risk_team_members')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!profile || profile.deleted_at) return null
  return {
    id: profile.id,
    role: profile.role,
    name: profile.name,
    isActive: profile.status === 'active',
    isRiskTeamMember: !teamMemberError && Boolean(teamMember?.user_id),
  }
}

/**
 * Every provisioned personnel account may access the IOR workflow.
 * Status is deliberately not checked here; IOR is not limited to active staff.
 */
export async function getIncidentActor(): Promise<RiskActor | null> {
  return getAuthenticatedRiskActor()
}

/** Backward-compatible name used by the report form/API. */
export async function getIncidentReporter(): Promise<RiskActor | null> {
  return getIncidentActor()
}

/** Active actor for permission-gated risk-register and administrative work. */
export async function getRiskActor(): Promise<RiskActor | null> {
  const actor = await getAuthenticatedRiskActor()
  return actor?.isActive === true ? actor : null
}

export async function getRiskPermission(actorOrRole: RiskActor | string) {
  const actor = typeof actorOrRole === 'string' ? null : actorOrRole
  const role = typeof actorOrRole === 'string' ? actorOrRole : actorOrRole.role
  if (actor?.isActive === false) return 'none'
  const perms = await getRolePermissions(role)
  const permission = perms[RISK_RESOURCE] ?? 'none'
  if (permission === 'none' && actor?.isRiskTeamMember) return 'view'
  return permission
}

/** สร้าง/แก้ไขข้อมูลได้ — ตัดสินจาก permission matrix ตามที่ CLAUDE.md กำหนด */
export async function canEditRisk(actor: RiskActor | null) {
  if (!actor || actor.isActive === false) return false
  return (await getRiskPermission(actor)) === 'edit'
}

/** สิทธิ์เชิงคุณภาพของ Risk Register และการยกระดับ IOR — ไม่ใช่สิทธิ์ workflow IOR ทั่วไป */
export function canReviewRisk(actor: RiskActor | null) {
  return canReviewRiskActor(actor)
}

/** IOR workflow: report, review, RCA, corrective action and follow-up. */
export function canManageIncident(actor: RiskActor | null) {
  return canManageIncidentActor(actor)
}

export function canCloseIncident(actor: RiskActor | null) {
  return canCloseIncidentActor(actor)
}

export function canCloseRegister(actor: RiskActor | null) {
  return canCloseRegisterActor(actor)
}

export { REVIEW_ONLY_FIELDS, REVIEW_WORKFLOW_FIELDS, pickReviewWorkflowFields, stripReviewOnlyFields } from './fields'

/** บันทึกร่องรอยการกระทำ — ไม่รอผลและไม่ให้ล้มเหลวกระทบงานหลัก */
export function auditRisk(action: string, actorId: string, target: string, detail?: string) {
  supabaseAdmin
    .from('audit_log')
    .insert({ action, user_id: actorId, target, detail: detail ?? target })
    .then(undefined, () => {})
}
