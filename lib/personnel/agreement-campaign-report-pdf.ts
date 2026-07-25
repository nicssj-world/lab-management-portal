import { readFile } from 'fs/promises'
import path from 'path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

type Recipient = { name: string; position: string | null; status: 'pending' | 'completed' | 'certified' | 'exempt'; exemptReason?: string | null; disclosureName?: string | null }
type Input = { title: string; fiscalYear: number; opensOn: string; dueOn: string; status: 'draft' | 'open' | 'approved'; approvedAt?: string | null; recipients: Recipient[] }
const MM = 72 / 25.4
const A4 = { width: 210 * MM, height: 297 * MM }

async function loadFonts(pdf: PDFDocument) {
  pdf.registerFontkit(fontkit)
  const base = path.join(process.cwd(), 'node_modules', 'font-th-sarabun-new', 'fonts')
  const [regular, bold] = await Promise.all([readFile(path.join(base, 'THSarabunNew-webfont.ttf')), readFile(path.join(base, 'THSarabunNew_bold-webfont.ttf'))])
  return { regular: await pdf.embedFont(regular), bold: await pdf.embedFont(bold) }
}

function thDate(value: string) { return new Date(value).toLocaleDateString('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }) }
function shortStatus(value: Recipient['status']) { return value === 'certified' ? 'รับรองแล้ว' : value === 'completed' ? 'ลงนามแล้ว' : value === 'exempt' ? 'ยกเว้น' : 'ค้าง' }

export async function generateAgreementCampaignReportPdf(input: Input) {
  const pdf = await PDFDocument.create(); const fonts = await loadFonts(pdf)
  const margin = 15 * MM; const width = A4.width - margin * 2
  let page!: PDFPage; let y = 0; let row = 0
  const text = (value: string, x: number, yy: number, font: PDFFont = fonts.regular, size = 12) => page.drawText(value, { x, y: yy, font, size, color: rgb(.07, .11, .18) })
  const newPage = () => {
    page = pdf.addPage([A4.width, A4.height]); y = A4.height - 17 * MM; row = 0
    const titleSize = 17; text('รายงานสรุปข้อตกลงประจำปี', margin + (width - fonts.bold.widthOfTextAtSize('รายงานสรุปข้อตกลงประจำปี', titleSize)) / 2, y, fonts.bold, titleSize); y -= 20
    text(input.title, margin, y, fonts.bold, 14); y -= 17
    text(`ปีงบประมาณ พ.ศ. ${input.fiscalYear} · เปิด ${thDate(input.opensOn)} · กำหนดส่ง ${thDate(input.dueOn)}`, margin, y, fonts.regular, 11); y -= 18
    const headers = ['บุคลากร', 'ตำแหน่ง', 'สถานะ', 'การเปิดเผย/เหตุผล']; const cols = [55 * MM, 42 * MM, 23 * MM, width - 120 * MM]; let x = margin
    for (let i = 0; i < headers.length; i += 1) { page.drawRectangle({ x, y: y - 7 * MM, width: cols[i], height: 7 * MM, color: rgb(.94, .96, .98), borderColor: rgb(.75, .79, .85), borderWidth: .4 }); text(headers[i], x + 2 * MM, y - 4.8 * MM, fonts.bold, 10); x += cols[i] }
    y -= 7 * MM
  }
  newPage()
  for (const recipient of input.recipients) {
    const height = 10 * MM
    if (y - height < 26 * MM) newPage()
    const cols = [55 * MM, 42 * MM, 23 * MM, width - 120 * MM]; const values = [recipient.name, recipient.position ?? '-', shortStatus(recipient.status), recipient.disclosureName ? `เปิดเผย: ${recipient.disclosureName}` : recipient.exemptReason ? `ยกเว้น: ${recipient.exemptReason}` : '-']; let x = margin
    for (let i = 0; i < values.length; i += 1) { page.drawRectangle({ x, y: y - height, width: cols[i], height, borderColor: rgb(.78, .82, .87), borderWidth: .35 }); text(values[i], x + 2 * MM, y - 5.8 * MM, i === 0 ? fonts.bold : fonts.regular, 10); x += cols[i] }
    y -= height; row += 1
  }
  if (y < 42 * MM) newPage()
  y -= 9
  const summary = { total: input.recipients.length, signed: input.recipients.filter((r) => r.status === 'completed').length, certified: input.recipients.filter((r) => r.status === 'certified').length, pending: input.recipients.filter((r) => r.status === 'pending').length, exempt: input.recipients.filter((r) => r.status === 'exempt').length, disclosures: input.recipients.filter((r) => r.disclosureName).length }
  text(`สรุป: ทั้งหมด ${summary.total} · ลงนามแล้ว ${summary.signed} · รับรองแล้ว ${summary.certified} · ค้าง ${summary.pending} · ยกเว้น ${summary.exempt} · เปิดเผยกิจกรรม ${summary.disclosures}`, margin, y, fonts.bold, 12); y -= 21
  text(`สถานะรอบ: ${input.status === 'approved' ? 'รับรองแล้ว' : input.status === 'open' ? 'เปิดรอบอยู่' : 'ร่าง'}`, margin, y, fonts.bold, 12); y -= 16
  if (input.approvedAt) text(`รับรองเมื่อ: ${new Date(input.approvedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' })}`, margin, y, fonts.regular, 11)
  for (let index = 0; index < pdf.getPageCount(); index += 1) {
    const footer = pdf.getPage(index)
    footer.drawText(`รายงานจากระบบ · หน้า ${index + 1}/${pdf.getPageCount()}`, { x: margin, y: 10 * MM, font: fonts.regular, size: 9, color: rgb(.35, .4, .47) })
  }
  return pdf.save()
}
