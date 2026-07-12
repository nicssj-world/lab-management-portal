import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { mapIorStatusToStatus, normalizeIsoDate, requiresRca, riskLevel, riskScore } from '@/lib/risk-utils'

const DATE_FIELDS = ['event_date', 'recorded_date', 'due_date', 'follow_up_date'] as const

export async function getRiskActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, role, name')
    .eq('id', user.id)
    .single()
  return data as { id: string; role: string; name: string | null } | null
}

export async function getRiskPermission(role: string) {
  const perms = await getRolePermissions(role)
  return perms['ความเสี่ยง / Rejection'] ?? 'none'
}

export async function canEditRisk(actor: { role: string } | null) {
  if (!actor) return false
  return await getRiskPermission(actor.role) === 'edit'
}

export function canReviewRisk(actor: { role: string } | null) {
  return actor?.role === 'Admin' || actor?.role === 'Manager'
}

function riskLevelText(level?: string | null) {
  if (level === 'high') return 'สูง'
  if (level === 'medium') return 'กลาง'
  if (level === 'low') return 'ต่ำ'
  return null
}

export function normalizeRiskPayload(input: Record<string, unknown>) {
  const likelihood = toInt(input.likelihood)
  const impact = toInt(input.impact)
  const score = riskScore(likelihood, impact)
  const severity = toText(input.severity_level)
  const level = riskLevel(score) ?? input.level ?? 'low'
  const isRiskAssessment = toText(input.event_type) === 'risk_assessment'
  const residualLikelihood = toInt(input.residual_likelihood)
  const residualImpact = toInt(input.residual_impact)
  const residualScore = riskScore(residualLikelihood, residualImpact)

  const payload: Record<string, unknown> = {
    ...input,
    likelihood,
    impact,
    level,
    severity_level: isRiskAssessment ? (severity || riskLevelText(level as string)) : severity,
    requires_rca: Boolean(input.requires_rca) || (!isRiskAssessment && requiresRca(severity)),
    residual_likelihood: residualLikelihood,
    residual_impact: residualImpact,
    residual_score: residualScore,
    residual_level: riskLevel(residualScore),
    updated_at: new Date().toISOString(),
  }

  for (const field of DATE_FIELDS) {
    if (field in input) payload[field] = normalizeIsoDate(input[field])
  }

  if (!payload.status) payload.status = mapIorStatusToStatus(toText(input.ior_status))
  if (!payload.review_status) payload.review_status = payload.requires_rca ? 'rca_required' : 'pending'
  if (!payload.name) payload.name = toText(input.event_detail)?.slice(0, 160) || toText(input.event_category) || 'ไม่ระบุ'

  return payload
}

export function toInt(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function toText(value: unknown) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}
