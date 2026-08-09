import fontkit from '@pdf-lib/fontkit'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { fiscalMonths, type SafetyInspectionProfileKey } from './monthly-safety'

export interface MonthlySafetyReportRow {
  roundItemId: string
  assetId: string
  assetCode: string
  assetName: string
  profile: SafetyInspectionProfileKey
  dueOn: string
  submittedAt: string | null
  submittedByName: string | null
  status: string
  issueCount: number
  templateSnapshot: Record<string, any>
  formSnapshot: Record<string, any>
}

interface PdfOptions {
  fiscalYear: number
  rows: MonthlySafetyReportRow[]
  titleSuffix?: string | null
}

const A4_LANDSCAPE: [number, number] = [841.89, 595.28]
const A4_PORTRAIT: [number, number] = [595.28, 841.89]
const INK = rgb(0.10, 0.13, 0.16)
const MUTED = rgb(0.35, 0.40, 0.45)
const BORDER = rgb(0.58, 0.63, 0.68)
const HEADER = rgb(0.88, 0.94, 0.96)
const MONTH_LABELS = ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.']

function text(value: unknown) { return typeof value === 'string' ? value : '' }
function list(value: unknown): Record<string, any>[] { return Array.isArray(value) ? value : [] }
function monthOf(row: MonthlySafetyReportRow) { return row.dueOn.slice(0, 7) }
function initials(name: string | null) {
  if (!name) return '-'
  return name.trim().split(/\s+/).map(part => part.slice(0, 1)).join('').slice(0, 4) || '-'
}
function shortDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(8, 10)
  return new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Bangkok' }).format(date)
}
function resultLabel(value: string) {
  return ({ normal: 'ปกติ', missing: 'ขาด', damaged: 'ชำรุด', expired: 'หมดอายุ', na: 'ไม่เกี่ยวข้อง' } as Record<string, string>)[value] ?? '-'
}
function fitText(value: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value
  let output = value
  while (output.length > 1 && font.widthOfTextAtSize(`${output}…`, size) > maxWidth) output = output.slice(0, -1)
  return `${output}…`
}
function centerText(page: PDFPage, value: string, x: number, y: number, width: number, font: PDFFont, size: number, color = INK) {
  const fitted = fitText(value, font, size, width - 4)
  const offset = Math.max(2, (width - font.widthOfTextAtSize(fitted, size)) / 2)
  page.drawText(fitted, { x: x + offset, y, size, font, color })
}
function cell(page: PDFPage, x: number, y: number, width: number, height: number, fill?: ReturnType<typeof rgb>) {
  page.drawRectangle({ x, y, width, height, color: fill, borderColor: BORDER, borderWidth: 0.55 })
}
function footer(page: PDFPage, font: PDFFont, reference: string) {
  page.drawLine({ start: { x: 34, y: 27 }, end: { x: page.getWidth() - 34, y: 27 }, thickness: 0.45, color: BORDER })
  page.drawText(`เลขอ้างอิงระบบ: ${reference}`, { x: 34, y: 13, font, size: 8, color: MUTED })
  page.drawText('สร้างจาก snapshot ของรอบตรวจในระบบ', { x: page.getWidth() - 195, y: 13, font, size: 8, color: MUTED })
}

function spillPages(pdf: PDFDocument, rows: MonthlySafetyReportRow[], fiscalYear: number, font: PDFFont, bold: PDFFont) {
  const groups = new Map<string, MonthlySafetyReportRow[]>()
  for (const row of rows.filter(item => item.profile !== 'nss_eyewash')) {
    const key = `${row.assetId}:${Number(row.templateSnapshot?.version ?? 0)}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  for (const groupRows of groups.values()) {
    const first = groupRows[0]
    const template = first.templateSnapshot ?? {}
    const page = pdf.addPage(A4_LANDSCAPE)
    page.drawText('รายงานตรวจสอบความพร้อมใช้งาน Spill Kit', { x: 34, y: 557, font: bold, size: 17, color: INK })
    page.drawText(`${first.assetCode} · ${first.assetName}`, { x: 34, y: 536, font: bold, size: 12, color: INK })
    page.drawText(`ปีงบประมาณ ${fiscalYear} · ${text(template.titleTh)} · Version ${Number(template.version ?? 0)}`, { x: 34, y: 519, font, size: 10, color: MUTED })

    const suppliesByLogicalKey = new Map<string, Record<string, any>>()
    for (const reportRow of groupRows) for (const supply of list(reportRow.templateSnapshot?.supplies)) {
      const key = text(supply.templateItemId ?? supply.template_item_id) || text(supply.internalCode ?? supply.internal_code)
      if (!suppliesByLogicalKey.has(key)) suppliesByLogicalKey.set(key, supply)
    }
    const supplies = [...suppliesByLogicalKey.values()]
    const startX = 34; const startY = 495; const tableWidth = 774
    const numberWidth = 24; const itemWidth = 222; const monthWidth = (tableWidth - numberWidth - itemWidth) / 12
    const headerHeight = 25; const rowHeight = Math.min(23, 414 / Math.max(supplies.length, 1))
    cell(page, startX, startY - headerHeight, numberWidth, headerHeight, HEADER)
    centerText(page, 'ลำดับ', startX, startY - 17, numberWidth, bold, 8)
    cell(page, startX + numberWidth, startY - headerHeight, itemWidth, headerHeight, HEADER)
    centerText(page, 'รายการอุปกรณ์', startX + numberWidth, startY - 17, itemWidth, bold, 9)
    MONTH_LABELS.forEach((label, index) => {
      const x = startX + numberWidth + itemWidth + index * monthWidth
      cell(page, x, startY - headerHeight, monthWidth, headerHeight, HEADER)
      centerText(page, label, x, startY - 17, monthWidth, bold, 8)
    })
    supplies.forEach((supply, rowIndex) => {
      const y = startY - headerHeight - (rowIndex + 1) * rowHeight
      cell(page, startX, y, numberWidth, rowHeight)
      centerText(page, String(rowIndex + 1), startX, y + rowHeight / 2 - 3, numberWidth, font, 7.5)
      cell(page, startX + numberWidth, y, itemWidth, rowHeight)
      page.drawText(fitText(text(supply.labelTh), font, 8.5, itemWidth - 8), { x: startX + numberWidth + 4, y: y + rowHeight / 2 - 3, font, size: 8.5, color: INK })
      fiscalMonths(fiscalYear).forEach((month, monthIndex) => {
        const x = startX + numberWidth + itemWidth + monthIndex * monthWidth
        cell(page, x, y, monthWidth, rowHeight)
        const reportRow = groupRows.find(item => monthOf(item) === month)
        const submission = reportRow?.formSnapshot?.submission
        const logicalKey = text(supply.templateItemId ?? supply.template_item_id) || text(supply.internalCode ?? supply.internal_code)
        const monthlySupply = list(reportRow?.templateSnapshot?.supplies).find(item => (text(item.templateItemId ?? item.template_item_id) || text(item.internalCode ?? item.internal_code)) === logicalKey)
        const answer = list(submission?.answers).find(item => text(item.supplyId) === text(monthlySupply?.id))
        const label = reportRow?.status === 'skipped' ? 'ข้าม' : answer ? resultLabel(text(answer.result)) : '-'
        centerText(page, label, x, y + rowHeight / 2 + 1, monthWidth, font, 6.6)
        if (reportRow?.submittedAt) centerText(page, `${initials(reportRow.submittedByName)} ${shortDate(reportRow.submittedAt)}`, x, y + 2.5, monthWidth, font, 5.5, MUTED)
      })
    })
    const corrections = groupRows.flatMap(reportRow => list(reportRow.formSnapshot?.submission?.answers)
      .filter(answer => text(answer.note)).map(answer => `${monthOf(reportRow)} ${text(answer.note)}`))
    if (corrections.length) page.drawText(fitText(`การแก้ไข: ${corrections.join('; ')}`, font, 7, 770), { x: 34, y: 35, font, size: 7, color: MUTED })
    footer(page, font, `${first.assetCode}/FY${fiscalYear}/V${Number(template.version ?? 0)}`)
  }
}

function nssPages(pdf: PDFDocument, rows: MonthlySafetyReportRow[], fiscalYear: number, font: PDFFont, bold: PDFFont) {
  const nssRows = rows.filter(item => item.profile === 'nss_eyewash')
  const byAsset = new Map<string, MonthlySafetyReportRow[]>()
  for (const row of nssRows) byAsset.set(row.assetId, [...(byAsset.get(row.assetId) ?? []), row])
  for (const assetRows of byAsset.values()) {
    const supplies = new Map<string, Record<string, any>>()
    for (const row of assetRows) for (const supply of list(row.templateSnapshot?.supplies)) supplies.set(text(supply.id), supply)
    for (const [supplyId, supply] of supplies) {
      const first = assetRows[0]
      const page = pdf.addPage(A4_PORTRAIT)
      centerText(page, 'แบบบันทึกการตรวจสอบน้ำยาล้างตา NSS', 34, 805, 527, bold, 18)
      centerText(page, '(Sodium Chloride irrigation)', 34, 787, 527, font, 11, MUTED)
      page.drawText(`จุดตรวจ: ${first.assetCode} · ${first.assetName}`, { x: 42, y: 752, font: bold, size: 12, color: INK })
      page.drawText(`รหัสขวด: ${text(supply.internalCode) || supplyId}`, { x: 42, y: 730, font, size: 11, color: INK })
      page.drawText(`วันผลิต/บรรจุ: ${text(supply.manufacturedOrPackedOn) || '-'}    วันที่ซื้อ: ${text(supply.purchasedOn) || '-'}    วันหมดอายุ: ${text(supply.expiresOn) || '-'}`, { x: 42, y: 710, font, size: 10, color: INK })
      page.drawText(`ผู้ขาย: ${text(supply.supplier) || '-'}    ปีงบประมาณ: ${fiscalYear}`, { x: 42, y: 692, font, size: 10, color: MUTED })

      const x = 42; const yTop = 662; const widths = [43, 92, 106, 88, 88, 110]
      const headers = ['เดือน', 'ความใส', 'สภาพขวด', 'ผู้ตรวจ', 'วันที่ตรวจ', 'การแก้ไขปัญหา']
      let cursor = x
      headers.forEach((header, index) => { cell(page, cursor, yTop - 30, widths[index], 30, HEADER); centerText(page, header, cursor, yTop - 20, widths[index], bold, 9); cursor += widths[index] })
      fiscalMonths(fiscalYear).forEach((month, rowIndex) => {
        const rowY = yTop - 30 - (rowIndex + 1) * 42
        const reportRow = assetRows.find(item => monthOf(item) === month)
        const inSnapshot = list(reportRow?.templateSnapshot?.supplies).some(item => text(item.id) === supplyId)
        const submission = reportRow?.formSnapshot?.submission
        const answer = list(submission?.bottles).find(item => text(item.supplyId) === supplyId)
        const values = !reportRow
          ? [MONTH_LABELS[rowIndex], '-', '-', '-', '-', '-']
          : inSnapshot
            ? [MONTH_LABELS[rowIndex], answer ? (text(answer.clarity) === 'clear' ? 'ใส' : 'ขุ่น') : '-', answer ? (text(answer.bottleCondition) === 'intact' ? 'สมบูรณ์' : 'มีรอยร้าว') : '-', initials(reportRow.submittedByName), shortDate(reportRow.submittedAt), text(answer?.correctiveAction) || '-']
            : [MONTH_LABELS[rowIndex], 'ไม่เกี่ยวข้อง', 'ไม่เกี่ยวข้อง', '-', '-', '-']
        cursor = x
        values.forEach((value, index) => { cell(page, cursor, rowY, widths[index], 42); centerText(page, value, cursor, rowY + 17, widths[index], font, index === 5 ? 8 : 9); cursor += widths[index] })
      })
      footer(page, font, `${first.assetCode}/FY${fiscalYear}/${text(supply.internalCode) || supplyId}`)
    }
  }
}

export async function createMonthlySafetyReportPdf(options: PdfOptions) {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const base = path.join(process.cwd(), 'node_modules', 'font-th-sarabun-new', 'fonts')
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(base, 'THSarabunNew-webfont.ttf')),
    readFile(path.join(base, 'THSarabunNew_bold-webfont.ttf')),
  ])
  const [font, bold] = await Promise.all([
    pdf.embedFont(regularBytes, { subset: true }),
    pdf.embedFont(boldBytes, { subset: true }),
  ])
  spillPages(pdf, options.rows, options.fiscalYear, font, bold)
  nssPages(pdf, options.rows, options.fiscalYear, font, bold)
  if (!pdf.getPageCount()) {
    const page = pdf.addPage(A4_PORTRAIT)
    centerText(page, 'ไม่พบข้อมูลการตรวจประจำเดือนตามตัวกรอง', 34, 430, 527, bold, 16)
    footer(page, font, `FY${options.fiscalYear}`)
  }
  pdf.setTitle(`รายงานตรวจ Spill Kit และ NSS ปีงบประมาณ ${options.fiscalYear}`)
  pdf.setSubject(options.titleSuffix ?? 'Safety Tasks & Evidence')
  pdf.setCreator('CBH Laboratory Management Portal')
  return pdf.save()
}
