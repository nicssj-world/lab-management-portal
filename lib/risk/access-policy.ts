import { normalizeRole } from '@/lib/roles'

export type RiskPolicyActor = {
  role: string | null | undefined
  isActive?: boolean
  isRiskTeamMember?: boolean
}

/** บุคลากรที่มี profile ในระบบจัดการ workflow ของ IOR ได้ทุกขั้น ยกเว้นการปิดเรื่อง */
export function canManageIncidentActor(actor: RiskPolicyActor | null | undefined): boolean {
  // สถานะบุคลากรไม่ใช่ตัวกั้นของ IOR — ข้อกำหนดคือบุคลากรทุกคนรายงานและช่วยจัดการได้
  return Boolean(actor)
}

/** ทะเบียนความเสี่ยงและงานยกระดับ IOR เป็น workflow ของคณะทำงานหรือ Manager/Admin */
export function canReviewRiskActor(actor: RiskPolicyActor | null | undefined): boolean {
  if (!actor || actor.isActive === false) return false
  return actor.isRiskTeamMember === true
    || normalizeRole(actor.role) === 'Admin'
    || normalizeRole(actor.role) === 'Manager'
}

/** การปิด IOR เป็นอำนาจ Manager/Admin เท่านั้น */
export function canCloseIncidentActor(actor: RiskPolicyActor | null | undefined): boolean {
  if (!actor || actor.isActive === false) return false
  const role = normalizeRole(actor.role)
  return role === 'Admin' || role === 'Manager'
}

/** ทะเบียนความเสี่ยงให้คณะทำงานยืนยัน/ปิดรายการได้ตาม workflow ที่กำหนด */
export function canCloseRegisterActor(actor: RiskPolicyActor | null | undefined): boolean {
  return canReviewRiskActor(actor)
}
