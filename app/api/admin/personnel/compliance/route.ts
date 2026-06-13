import { NextResponse } from 'next/server'
import { requireResource } from '@/lib/auth/guards'
import {
  getStaffRoster,
  getAllCertifications,
  getAllCompetencies,
  getAllTraining,
} from '@/lib/queries/personnel'
import { expiryStatus } from '@/lib/personnel/expiry'
import { toMsg } from '@/lib/personnel/crud'

export async function GET() {
  const { actor, response } = await requireResource('บุคลากร', 'view')
  if (!actor) return response
  try {
    const [roster, certs, comps, training] = await Promise.all([
      getStaffRoster(),
      getAllCertifications(),
      getAllCompetencies(),
      getAllTraining(),
    ])

    const staffCount = roster.length
    const withLicense = roster.filter((p) => p.mt_license_no).length
    const licenseExpiring = roster.filter((p) => expiryStatus(p.mt_license_expiry) === 'expiring').length
    const licenseExpired = roster.filter((p) => expiryStatus(p.mt_license_expiry) === 'expired').length

    const certExpiring = certs.filter((c) => expiryStatus(c.expiry_date) === 'expiring').length
    const certExpired = certs.filter((c) => expiryStatus(c.expiry_date) === 'expired').length

    const compPass = comps.filter((c) => c.result === 'pass').length
    const compTotal = comps.filter((c) => c.result != null).length
    const compOverdue = comps.filter((c) => expiryStatus(c.next_due_date) === 'expired').length
    const compDueSoon = comps.filter((c) => expiryStatus(c.next_due_date) === 'expiring').length

    const staffWithTraining = new Set(training.map((t) => t.profile_id)).size
    const staffWithCompetency = new Set(comps.map((c) => c.profile_id)).size

    // ISO 15189:2022 clause 6.2 evidence checklist
    const checklist = [
      { clause: '6.2.2', title: 'คุณสมบัติ/ประวัติบุคลากร (วุฒิ, ใบ ทนพ.)', met: withLicense > 0, evidence: `${withLicense}/${staffCount} คนมีเลขใบประกอบวิชาชีพ` },
      { clause: '6.2.3', title: 'ใบรับรอง/Certification', met: certs.length > 0, evidence: `${certs.length} รายการใบรับรอง` },
      { clause: '6.2.4', title: 'การฝึกอบรม (Training records)', met: staffWithTraining > 0, evidence: `${staffWithTraining}/${staffCount} คนมีบันทึกการอบรม` },
      { clause: '6.2.5', title: 'การประเมินสมรรถนะ (Competency)', met: staffWithCompetency > 0, evidence: `${staffWithCompetency}/${staffCount} คนได้รับการประเมิน · ค้าง ${compOverdue}` },
      { clause: '6.2.6', title: 'การมอบหมาย/Authorization', met: comps.length > 0, evidence: `อ้างอิงสมรรถนะ ${comps.length} รายการ` },
    ]

    return NextResponse.json({
      summary: {
        staffCount,
        withLicense,
        licenseExpiring,
        licenseExpired,
        certExpiring,
        certExpired,
        compPass,
        compTotal,
        compPassRate: compTotal ? Math.round((compPass / compTotal) * 100) : null,
        compOverdue,
        compDueSoon,
        staffWithTraining,
      },
      checklist,
    })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
