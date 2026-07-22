import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'

export const RISK_RESOURCE = 'ความเสี่ยง / Rejection'

export type RiskActor = { id: string; role: string; name: string | null }

export async function getRiskActor(): Promise<RiskActor | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, role, name')
    .eq('id', user.id)
    .single()
  return (data as RiskActor | null) ?? null
}

export async function getRiskPermission(role: string) {
  const perms = await getRolePermissions(role)
  return perms[RISK_RESOURCE] ?? 'none'
}

/** สร้าง/แก้ไขข้อมูลได้ — ตัดสินจาก permission matrix ตามที่ CLAUDE.md กำหนด */
export async function canEditRisk(actor: RiskActor | null) {
  if (!actor) return false
  return (await getRiskPermission(actor.role)) === 'edit'
}

/**
 * ทบทวน · ให้ระดับความรุนแรง · วิเคราะห์รากของปัญหา · สั่งมาตรการ · ปิดเรื่อง
 *
 * เป็นการตัดสินใจเชิงคุณภาพ จึงผูกกับตำแหน่งไม่ใช่ permission matrix
 * ต่างจากการ "แก้ไขข้อมูล" ที่ใช้ canEditRisk — อย่ารวมสองอย่างนี้เข้าด้วยกัน
 */
export function canReviewRisk(actor: RiskActor | null) {
  return actor?.role === 'Admin' || actor?.role === 'Manager'
}

export { REVIEW_ONLY_FIELDS, stripReviewOnlyFields } from './fields'

/** บันทึกร่องรอยการกระทำ — ไม่รอผลและไม่ให้ล้มเหลวกระทบงานหลัก */
export function auditRisk(action: string, actorId: string, target: string, detail?: string) {
  supabaseAdmin
    .from('audit_log')
    .insert({ action, user_id: actorId, target, detail: detail ?? target })
    .then(undefined, () => {})
}
