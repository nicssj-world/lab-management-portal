import { readFile } from 'fs/promises'
import path from 'path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { DEFAULT_DOCUMENT_AUDIENCE, DOCUMENT_TYPE_LABELS } from '@/lib/documents/workflow'

const MM = 72 / 25.4
const A4 = { width: 210 * MM, height: 297 * MM }
const BLACK = rgb(0, 0, 0)
const BLUE = rgb(0.02, 0.12, 0.86)

export type CoverPerson = {
  name?: string | null
  position?: string | null
  signatureBytes?: Uint8Array | null
  signatureType?: string | null
}

export type CoverInput = {
  documentCode: string
  title: string
  type: string
  department?: string | null
  departmentEn?: string | null
  revision?: string | null
  pageCount?: number | null
  editDate?: string | null
  approvedAt?: string | null
  effectiveDate?: string | null
  audienceText?: string | null
  owner?: CoverPerson
  reviewer?: CoverPerson
  approver?: CoverPerson
}

type Fonts = { regular: PDFFont; bold: PDFFont }

function mm(value: number) {
  return value * MM
}

function fmtThaiDate(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
}

function fmtEnDate(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' })
}

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = BLACK) {
  page.drawText(text || '', { x, y, font, size, color, lineHeight: size * 1.25 })
}

function drawCentered(page: PDFPage, text: string, x: number, y: number, width: number, font: PDFFont, size: number, color = BLACK) {
  const textWidth = font.widthOfTextAtSize(text, size)
  drawText(page, text, x + Math.max(0, (width - textWidth) / 2), y, font, size, color)
}

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number, width = 0.6) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: width, color: BLACK })
}

function rect(page: PDFPage, x: number, y: number, width: number, height: number, thickness = 0.7) {
  page.drawRectangle({ x, y, width, height, borderWidth: thickness, borderColor: BLACK })
}

function wrapText(text: string, font: PDFFont, size: number, width: number) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= width || !current) {
      current = next
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawLabelValue(page: PDFPage, label: string, value: string, x: number, y: number, labelWidth: number, fonts: Fonts, size = 11) {
  drawText(page, label, x, y, fonts.bold, size)
  drawText(page, ':', x + labelWidth - mm(3), y, fonts.regular, size)
  drawText(page, value, x + labelWidth + mm(2), y, fonts.regular, size)
}

async function loadFonts(pdf: PDFDocument): Promise<Fonts> {
  pdf.registerFontkit(fontkit)
  const base = path.join(process.cwd(), 'node_modules', '@fontsource', 'noto-sans-thai', 'files')
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(base, 'noto-sans-thai-thai-400-normal.woff')),
    readFile(path.join(base, 'noto-sans-thai-thai-700-normal.woff')),
  ])
  return {
    regular: await pdf.embedFont(regularBytes),
    bold: await pdf.embedFont(boldBytes),
  }
}

async function drawLogo(pdf: PDFDocument, page: PDFPage, x: number, y: number, width: number, height: number) {
  const logoPath = path.join(process.cwd(), 'public', 'brand', 'logo-chonburi.png')
  const logoBytes = await readFile(logoPath)
  const logo = await pdf.embedPng(logoBytes)
  const scale = Math.min(width / logo.width, height / logo.height)
  const drawWidth = logo.width * scale
  const drawHeight = logo.height * scale
  page.drawImage(logo, {
    x: x + (width - drawWidth) / 2,
    y: y + (height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  })
}

async function drawSignature(pdf: PDFDocument, page: PDFPage, person: CoverPerson | undefined, x: number, y: number, width: number, height: number) {
  if (!person?.signatureBytes?.length) return
  try {
    const img = person.signatureType?.includes('png')
      ? await pdf.embedPng(person.signatureBytes)
      : await pdf.embedJpg(person.signatureBytes)
    const scale = Math.min(width / img.width, height / img.height)
    const drawWidth = img.width * scale
    const drawHeight = img.height * scale
    page.drawImage(img, {
      x: x + (width - drawWidth) / 2,
      y: y + (height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    })
  } catch {
    // Keep cover generation non-blocking if a stored signature image is invalid.
  }
}

function drawFullWidthRows(page: PDFPage, rows: [string, string][], x: number, topY: number, width: number, rowHeight: number, fonts: Fonts) {
  const labelW = mm(47)
  let y = topY
  for (const [label, value] of rows) {
    y -= rowHeight
    line(page, x, y, x + width, y)
    drawLabelValue(page, label, value, x + mm(4), y + mm(4.5), labelW, fonts)
  }
  return y
}

async function drawSignatureRow(
  pdf: PDFDocument,
  page: PDFPage,
  roleLabel: string,
  dateValue: string,
  person: CoverPerson | undefined,
  x: number,
  y: number,
  leftW: number,
  rightW: number,
  height: number,
  fonts: Fonts,
) {
  const bottom = y - height
  line(page, x, bottom, x + leftW + rightW, bottom)
  line(page, x + leftW, y, x + leftW, bottom)
  drawText(page, `${roleLabel} : ${person?.name ?? ''}`, x + mm(4), y - mm(11), fonts.regular, 11)
  drawText(page, `ตำแหน่ง : ${person?.position ?? ''}`, x + mm(4), y - mm(22), fonts.regular, 11)
  drawText(page, 'ลายมือชื่อ', x + leftW + mm(4), y - mm(9), fonts.regular, 11)
  await drawSignature(pdf, page, person, x + leftW + mm(28), bottom + mm(14), mm(54), mm(16))
  drawText(page, `วันที่ ${dateValue}`, x + leftW + mm(4), bottom + mm(5), fonts.regular, 11)
}

export async function generateQualityCoverPdf(input: CoverInput) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([A4.width, A4.height])
  const fonts = await loadFonts(pdf)

  const x = mm(14)
  const width = A4.width - mm(28)
  let y = A4.height - mm(13)
  const top = y
  const headerH = mm(68)
  const leftW = mm(92)
  const rightW = width - leftW
  rect(page, x, top - headerH, width, headerH)
  line(page, x + leftW, top, x + leftW, top - headerH)
  await drawLogo(pdf, page, x + mm(12), top - mm(52), leftW - mm(24), mm(38))
  drawCentered(page, 'กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี', x, top - mm(59), leftW, fonts.regular, 7.8)

  const titleH = mm(15)
  line(page, x + leftW, top - titleH, x + width, top - titleH)
  drawCentered(page, 'เอกสารควบคุม', x + leftW, top - mm(10.5), rightW, fonts.bold, 17, BLUE)

  const rightX = x + leftW + mm(4)
  const labelW = mm(34)
  const docType = DOCUMENT_TYPE_LABELS[input.type] ?? DOCUMENT_TYPE_LABELS.Others
  drawLabelValue(page, 'ประเภทเอกสาร', docType.th, rightX, top - mm(22), labelW, fonts, 9.7)
  drawLabelValue(page, '(Document Type)', docType.en, rightX, top - mm(30), labelW, fonts, 9.7)
  line(page, x + leftW, top - mm(33), x + width, top - mm(33))
  drawLabelValue(page, 'แผนก', input.department ?? '', rightX, top - mm(40), labelW, fonts, 9.7)
  drawLabelValue(page, '(Department)', input.departmentEn ?? '', rightX, top - mm(47), labelW, fonts, 9.7)
  line(page, x + leftW, top - mm(51), x + width, top - mm(51))
  drawLabelValue(page, 'ครั้งที่แก้ไข', input.revision ?? '', rightX, top - mm(58), labelW, fonts, 9.7)
  drawLabelValue(page, '(Revision)', input.revision ? `Rev. ${input.revision}` : '', rightX, top - mm(65), labelW, fonts, 9.7)

  y = top - headerH
  const identityRows: [string, string][] = [
    ['เรื่อง', input.title],
    ['หมายเลขเอกสาร', input.documentCode],
    ['หน้า/จำนวนหน้า', `1 / ${input.pageCount ?? ''}`.trim()],
  ]
  y = drawFullWidthRows(page, identityRows, x, y, width, mm(14), fonts)

  const dateRows: [string, string][] = [
    ['วันที่แก้ไขเอกสาร', fmtThaiDate(input.editDate)],
    ['(Edit Date)', fmtEnDate(input.editDate)],
    ['วันที่อนุมัติเอกสาร', fmtThaiDate(input.approvedAt)],
    ['(Approved Date)', fmtEnDate(input.approvedAt)],
    ['วันที่บังคับใช้เอกสาร', fmtThaiDate(input.effectiveDate)],
    ['(Effective Date)', fmtEnDate(input.effectiveDate)],
  ]
  y = drawFullWidthRows(page, dateRows, x, y, width, mm(11.5), fonts)

  const audienceH = mm(21)
  y -= audienceH
  line(page, x, y, x + width, y)
  const audience = `ผู้เกี่ยวข้องที่ต้องรับทราบ : ${input.audienceText || DEFAULT_DOCUMENT_AUDIENCE}`
  const lines = wrapText(audience, fonts.regular, 10.5, width - mm(8))
  lines.slice(0, 2).forEach((lineText, idx) => {
    drawText(page, lineText, x + mm(4), y + audienceH - mm(8 + idx * 7), fonts.regular, 10.5)
  })

  await drawSignatureRow(pdf, page, 'จัดทำโดย', fmtThaiDate(input.editDate), input.owner, x, y, width * 0.52, width * 0.48, mm(25), fonts)
  y -= mm(25)
  await drawSignatureRow(pdf, page, 'รับรองโดย', fmtThaiDate(input.approvedAt), input.reviewer, x, y, width * 0.52, width * 0.48, mm(25), fonts)
  y -= mm(25)
  await drawSignatureRow(pdf, page, 'อนุมัติโดย', fmtThaiDate(input.approvedAt), input.approver, x, y, width * 0.52, width * 0.48, mm(25), fonts)

  return pdf.save()
}

export async function mergeCoverWithPdf(coverPdfBytes: Uint8Array, contentPdfBytes: Uint8Array) {
  const output = await PDFDocument.create()
  const cover = await PDFDocument.load(coverPdfBytes)
  const content = await PDFDocument.load(contentPdfBytes)
  const coverPages = await output.copyPages(cover, cover.getPageIndices())
  coverPages.forEach(page => output.addPage(page))
  const contentPages = await output.copyPages(content, content.getPageIndices())
  contentPages.forEach(page => output.addPage(page))
  return output.save()
}
