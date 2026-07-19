import { NextRequest } from 'next/server'
import { externalQualityContext, externalQualityError } from '@/lib/external-quality/access'
import { buildExcel, buildThaiPdf, exportResponse } from '@/lib/external-quality/export'
import { getOutlabOverview } from '@/lib/outlab/server'
import { OUTLAB_SECTOR_LABEL } from '@/lib/outlab/domain'

const value = (input: unknown) => input == null ? '' : String(input)

export async function GET(req: NextRequest) {
  const ctx = await externalQualityContext('outlab')
  if (ctx.response) return ctx.response
  try {
    const overview = await getOutlabOverview()
    const labName = new Map(overview.laboratories.map(lab => [lab.id, lab.name]))
    const certificates = overview.laboratories.flatMap(lab => lab.certificates)
    const date = new Date().toISOString().slice(0, 10)
    if (req.nextUrl.searchParams.get('format') === 'pdf') {
      const rows = certificates.map(cert => [
        value(labName.get(cert.laboratory_id)), value(cert.standard_name), value(cert.certificate_no),
        value(cert.valid_from), value(cert.expires_on), value(cert.lifecycle), value(cert.urgency),
      ])
      return exportResponse(
        buildThaiPdf('ทะเบียนใบรับรองห้องปฏิบัติการภายนอก', `ข้อมูล ณ ${date}`, ['ห้องปฏิบัติการ', 'มาตรฐาน', 'เลขที่', 'เริ่ม', 'หมดอายุ', 'วงจร', 'ระดับเตือน'], rows),
        `outlab-certificates-${date}.pdf`, 'application/pdf',
      )
    }
    const buffer = buildExcel([
      { name: 'ห้องปฏิบัติการ', rows: overview.laboratories.map(lab => ({ ชื่อ: lab.name, ประเภท: OUTLAB_SECTOR_LABEL[lab.sector], หน่วยงาน: lab.brand, โทรศัพท์: lab.contact_phone, อีเมล: lab.contact_email, ใช้งาน: lab.active ? 'ใช่' : 'ไม่', เผยแพร่: lab.publish_public ? 'ใช่' : 'ไม่' })) },
      { name: 'บริการส่งต่อ', rows: overview.services.map(service => ({ ห้องปฏิบัติการ: labName.get(service.laboratory_id), รายการตรวจ: service.test_name_snapshot, รหัสภายนอก: service.external_code, วิธีตรวจ: service.method, สิ่งส่งตรวจ: service.specimen, การขนส่ง: service.transport_condition, TAT: service.tat_text, ราคา: service.price, ห้องหลัก: service.is_primary ? 'ใช่' : 'ไม่', ใช้งาน: service.active ? 'ใช่' : 'ไม่' })) },
      { name: 'ใบรับรอง', rows: certificates.map(cert => ({ ห้องปฏิบัติการ: labName.get(cert.laboratory_id), มาตรฐาน: cert.standard_name, หน่วยรับรอง: cert.accreditation_body, เลขที่ใบ: cert.certificate_no, ขอบข่าย: cert.scope, วันที่เริ่ม: cert.valid_from, วันหมดอายุ: cert.expires_on, สถานะ: cert.lifecycle, ระดับเตือน: cert.urgency })) },
    ])
    return exportResponse(buffer, `outlab-${date}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  } catch (error) {
    return externalQualityError(error)
  }
}
