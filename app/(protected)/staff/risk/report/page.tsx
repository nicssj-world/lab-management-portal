import { redirect } from 'next/navigation'
import { IncidentReportForm } from '@/components/risk/IncidentReportForm'
import { getRiskActor, getRiskPermission } from '@/lib/risk/access'

/**
 * หน้ารายงานอุบัติการณ์สำหรับเจ้าหน้าที่ทุกคน
 *
 * ตรวจแค่ว่าล็อกอินอยู่ ไม่ตรวจ permission matrix โดยตั้งใจ — คนที่เห็นเหตุการณ์
 * ต้องรายงานได้เสมอ แม้จะไม่มีสิทธิ์เข้าถึงทะเบียนความเสี่ยง
 */
export default async function IncidentReportPage() {
  const actor = await getRiskActor()
  if (!actor) redirect('/login')

  const permission = await getRiskPermission(actor.role)
  return (
    <IncidentReportForm
      reporterName={actor.name}
      canSeeQueue={permission !== 'none'}
      canRecordOnBehalf={permission === 'edit'}
    />
  )
}
