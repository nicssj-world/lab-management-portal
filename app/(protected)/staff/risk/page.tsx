import { redirect } from 'next/navigation'
import { RiskOverview } from '@/components/risk/RiskOverview'
import { canCloseIncident, canCloseRegister, canReviewRisk, getIncidentActor, getRiskActor, getRiskPermission, canManageIncident, canEditRisk } from '@/lib/risk/access'

/** ผู้ใช้ที่เข้าโมดูลได้ พร้อมสิทธิ์ที่ใช้ตัดสินว่าเห็นปุ่มอะไรบ้าง */
export async function requireRiskAccess() {
  const actor = await getRiskActor()
  if (!actor) redirect('/login')

  const permission = await getRiskPermission(actor)
  if (permission === 'none') redirect('/staff/dashboard')

  return {
    actor,
    canEdit: permission === 'edit',
    canReview: canReviewRisk(actor),
    canCloseIncident: canCloseIncident(actor),
    canCloseRegister: canCloseRegister(actor),
  }
}

/** ผู้ใช้ที่เข้า IOR ได้ — บุคลากรทุกคนที่มี profile จัดการ workflow ได้ ยกเว้นปิดเรื่อง */
export async function requireIncidentAccess() {
  const actor = await getIncidentActor()
  if (!actor) redirect('/login')

  const permission = await getRiskPermission(actor)
  return {
    actor,
    canEdit: await canEditRisk(actor),
    canReview: canManageIncident(actor),
    canEscalate: canReviewRisk(actor),
    canCloseIncident: canCloseIncident(actor),
    canAccessRiskModule: permission !== 'none',
  }
}

export default async function RiskOverviewPage() {
  await requireRiskAccess()
  return <RiskOverview />
}
