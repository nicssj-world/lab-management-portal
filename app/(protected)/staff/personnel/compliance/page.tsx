import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRolePermissions } from '@/lib/permissions'
import {
  getStaffRoster, getAllCertifications, getAllCompetencies, getAllTraining, getActiveJdProfileIds,
} from '@/lib/queries/personnel'
import { expiryStatus } from '@/lib/personnel/expiry'
import { ComplianceClient, type ComplianceData } from './ComplianceClient'

export default async function CompliancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['บุคลากร'] ?? 'none') === 'none') redirect('/staff/dashboard')

  const [roster, certs, comps, training, jdProfileIds] = await Promise.all([
    getStaffRoster(), getAllCertifications(), getAllCompetencies(), getAllTraining(), getActiveJdProfileIds(),
  ])

  const staffCount = roster.length
  const withLicense = roster.filter((p) => p.mt_license_no).length
  const compPass = comps.filter((c) => c.result === 'pass').length
  const compTotal = comps.filter((c) => c.result != null).length
  const staffWithTraining = new Set(training.map((t) => t.profile_id)).size
  const staffWithCompetency = new Set(comps.map((c) => c.profile_id)).size
  const compOverdue = comps.filter((c) => expiryStatus(c.next_due_date) === 'expired').length

  const data: ComplianceData = {
    generatedAt: new Date().toISOString(),
    kpi: {
      trainingRate: staffCount ? Math.round((staffWithTraining / staffCount) * 100) : 0,
      competencyPassRate: compTotal ? Math.round((compPass / compTotal) * 100) : 0,
      jdCoverage: staffCount ? Math.round(([...jdProfileIds].filter((id) => roster.some((p) => p.id === id)).length / staffCount) * 100) : 0,
      competencyCoverage: staffCount ? Math.round((staffWithCompetency / staffCount) * 100) : 0,
    },
    summary: {
      staffCount, withLicense,
      licenseExpiring: roster.filter((p) => expiryStatus(p.mt_license_expiry) === 'expiring').length,
      licenseExpired: roster.filter((p) => expiryStatus(p.mt_license_expiry) === 'expired').length,
      certCount: certs.length,
      certExpiring: certs.filter((c) => expiryStatus(c.expiry_date) === 'expiring').length,
      certExpired: certs.filter((c) => expiryStatus(c.expiry_date) === 'expired').length,
      compPassRate: compTotal ? Math.round((compPass / compTotal) * 100) : null,
      compOverdue, trainingRecords: training.length, staffWithTraining,
    },
    checklist: [
      { clause: 'คุณสมบัติ',   title: 'คุณสมบัติ/ประวัติบุคลากร', met: withLicense > 0, evidence: `${withLicense}/${staffCount} คนมีเลขใบประกอบวิชาชีพ` },
      { clause: 'ใบรับรอง',    title: 'ใบอนุญาต/Certification', met: certs.length > 0, evidence: `${certs.length} รายการใบรับรอง · หมดอายุ ${certs.filter((c) => expiryStatus(c.expiry_date) === 'expired').length}` },
      { clause: 'การอบรม',     title: 'การฝึกอบรม', met: staffWithTraining > 0, evidence: `${staffWithTraining}/${staffCount} คนมีบันทึก · รวม ${training.length} รายการ` },
      { clause: 'สมรรถนะ',    title: 'การประเมินสมรรถนะ', met: staffWithCompetency > 0, evidence: `${staffWithCompetency}/${staffCount} คนได้ประเมิน · ค้าง ${compOverdue}` },
      { clause: 'มอบหมายงาน', title: 'การมอบหมายสิทธิ์ปฏิบัติงาน', met: comps.length > 0, evidence: `อ้างอิงสมรรถนะ ${comps.length} รายการ` },
    ],
    staffRows: roster.map((p) => ({
      name: p.name, role: p.role, position: p.position_title ?? '', unit: p.dept ?? p.unit ?? '',
      license: p.mt_license_no ?? '', licenseExpiry: p.mt_license_expiry ?? '',
      certCount: certs.filter((c) => c.profile_id === p.id).length,
      trainingCount: training.filter((t) => t.profile_id === p.id).length,
      competencyCount: comps.filter((c) => c.profile_id === p.id).length,
    })),
  }

  return <ComplianceClient data={data} />
}
