import { redirect } from 'next/navigation'
import { RiskOverview } from '@/components/risk/RiskOverview'
import { getRiskActor, getRiskPermission } from '@/lib/risk/access'

/** ผู้ใช้ที่เข้าโมดูลได้ พร้อมสิทธิ์ที่ใช้ตัดสินว่าเห็นปุ่มอะไรบ้าง */
export async function requireRiskAccess() {
  const actor = await getRiskActor()
  if (!actor) redirect('/login')

  const permission = await getRiskPermission(actor.role)
  if (permission === 'none') redirect('/staff/dashboard')

  return {
    actor,
    canEdit: permission === 'edit',
    canReview: actor.role === 'Admin' || actor.role === 'Manager',
  }
}

export default async function RiskOverviewPage() {
  await requireRiskAccess()
  return <RiskOverview />
}
