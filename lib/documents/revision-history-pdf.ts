import { readFile } from 'fs/promises'
import path from 'path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const PORTAL_REVISION_HISTORY_MARKER = 'CARS_PORTAL_REVISION_HISTORY'

const MM = 72 / 25.4
const A4 = { width: 297 * MM, height: 210 * MM }
const BLACK = rgb(0, 0, 0)
const WHITE = rgb(1, 1, 1)
const GRAY = rgb(0.34, 0.34, 0.34)
const LIGHT_GRAY = rgb(0.96, 0.96, 0.96)

type Fonts = { regular: PDFFont; bold: PDFFont }

type RevisionHistoryRow = {
  id: string
  revision_number: string
  revision_note: string | null
  revised_by: string | null
  approved_by: string | null
  file_url: string | null
  file_name: string | null
  created_at: string
  history_source?: string | null
}

type RevisionHistoryDocument = {
  id: string
  document_code: string
  title: string
  type: string
  revision: string | null
  description: string | null
  owner_name: string | null
  approver_name: string | null
  file_url: string | null
  file_name: string | null
  edit_date: string | null
  effective_date: string | null
  published_at: string | null
  updated_at: string
  created_at: string
}

type RevisionHistoryInput = {
  document: RevisionHistoryDocument
  revisions: RevisionHistoryRow[]
}

const TYPE_LABELS: Record<string, string> = {
  QP: 'ระเบียบปฏิบัติ QP',
  WI: 'วิธีปฏิบัติ (WI)',
  Manual: 'คู่มือคุณภาพ (QM)',
  Form: 'แบบฟอร์ม (Form)',
  Policy: 'นโยบาย (Policy)',
  Record: 'บันทึกคุณภาพ (Record)',
  Reference: 'เอกสารอ้างอิง (Reference)',
  'Card file': 'Card file',
  Others: 'เอกสารอื่นๆ',
}

function mm(value: number) {
  return value * MM
}

function fmtThaiDate(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function loadFonts(pdf: PDFDocument): Promise<Fonts> {
  pdf.registerFontkit(fontkit)
  const sarabunBase = path.join(process.cwd(), 'node_modules', 'font-th-sarabun-new', 'fonts')
  const fallbackBase = path.join(process.cwd(), 'node_modules', '@fontsource', 'noto-sans-thai', 'files')
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(sarabunBase, 'THSarabunNew-webfont.ttf'))
      .catch(() => readFile(path.join(fallbackBase, 'noto-sans-thai-thai-400-normal.woff'))),
    readFile(path.join(sarabunBase, 'THSarabunNew_bold-webfont.ttf'))
      .catch(() => readFile(path.join(fallbackBase, 'noto-sans-thai-thai-700-normal.woff'))),
  ])
  return {
    regular: await pdf.embedFont(regularBytes),
    bold: await pdf.embedFont(boldBytes),
  }
}

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = BLACK) {
  page.drawText(text || '', { x, y, font, size, color, lineHeight: size * 1.2 })
}

function drawCentered(page: PDFPage, text: string, x: number, y: number, width: number, font: PDFFont, size: number) {
  const textWidth = font.widthOfTextAtSize(text, size)
  drawText(page, text, x + Math.max(0, (width - textWidth) / 2), y, font, size)
}

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number, width = 0.6, color = BLACK) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: width, color })
}

function rect(page: PDFPage, x: number, y: number, width: number, height: number, thickness = 0.7, fill?: ReturnType<typeof rgb>) {
  page.drawRectangle({ x, y, width, height, borderWidth: thickness, borderColor: BLACK, color: fill })
}

function splitThaiAware(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const tokens = clean.includes(' ') ? clean.split(' ') : Array.from(clean)
  return tokens
}

function breakWideToken(token: string, font: PDFFont, size: number, width: number): string[] {
  const parts: string[] = []
  let current = ''
  for (const char of Array.from(token)) {
    const next = current + char
    if (font.widthOfTextAtSize(next, size) <= width) {
      current = next
    } else {
      if (current) parts.push(current)
      current = char
    }
  }
  if (current) parts.push(current)
  return parts
}

function wrapText(text: string | null | undefined, font: PDFFont, size: number, width: number, maxLines = 4) {
  const tokens = splitThaiAware(text ?? '')
  const lines: string[] = []
  let current = ''
  const hasSpaces = (text ?? '').includes(' ')

  for (const token of tokens) {
    const separator = current && hasSpaces ? ' ' : ''
    const candidate = current ? `${current}${separator}${token}` : token

    if (font.widthOfTextAtSize(candidate, size) <= width) {
      current = candidate
    } else if (font.widthOfTextAtSize(token, size) > width) {
      if (current) {
        lines.push(current)
        current = ''
        if (lines.length >= maxLines) break
      }
      for (const part of breakWideToken(token, font, size, width)) {
        if (lines.length >= maxLines) break
        if (current) {
          lines.push(current)
          current = ''
        }
        current = part
      }
    } else {
      lines.push(current)
      current = token
      if (lines.length >= maxLines) break
    }
  }

  if (current && lines.length < maxLines) lines.push(current)
  if (lines.length === maxLines && tokens.length > 0) {
    const last = lines[lines.length - 1]
    if (font.widthOfTextAtSize(`${last}...`, size) <= width) lines[lines.length - 1] = `${last}...`
  }
  return lines
}

function rowDate(row: RevisionHistoryRow) {
  return fmtThaiDate(row.created_at)
}

function sortRevisionRows(rows: RevisionHistoryRow[]) {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  return [...rows].sort((a, b) => {
    const revisionOrder = collator.compare(a.revision_number, b.revision_number)
    if (revisionOrder !== 0) return revisionOrder
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

function buildRows(input: RevisionHistoryInput) {
  const doc = input.document
  const currentRevisionRow: RevisionHistoryRow = {
    id: `current-${doc.id}`,
    revision_number: doc.revision ?? '',
    revision_note: doc.description ?? null,
    revised_by: doc.owner_name ?? null,
    approved_by: doc.approver_name ?? null,
    file_url: doc.file_url ?? null,
    file_name: doc.file_name ?? null,
    created_at: doc.edit_date ?? doc.effective_date ?? doc.published_at ?? doc.updated_at ?? doc.created_at,
    history_source: 'current',
  }
  const archivedRows = input.revisions.filter((rev) => (
    rev.revision_number !== currentRevisionRow.revision_number
    || rev.file_url !== currentRevisionRow.file_url
  ))
  return sortRevisionRows([...archivedRows, currentRevisionRow])
}

function drawHeader(page: PDFPage, doc: RevisionHistoryDocument, fonts: Fonts) {
  const x = mm(10)
  const width = A4.width - mm(20)
  drawCentered(page, 'แบบบันทึกประวัติการแก้ไข/ทบทวนเอกสาร', x, A4.height - mm(15), width, fonts.bold, 16)
  drawCentered(page, 'กลุ่มงานเทคนิคการแพทย์โรงพยาบาลชลบุรี', x, A4.height - mm(25), width, fonts.bold, 16)
  drawCentered(page, `ประเภทเอกสาร ${TYPE_LABELS[doc.type] ?? doc.type}`, x, A4.height - mm(36), width, fonts.bold, 16)
  drawCentered(page, `เรื่อง ${doc.title}   รหัส ${doc.document_code}`, x, A4.height - mm(47), width, fonts.bold, 16)
}

function drawFooter(page: PDFPage, fonts: Fonts) {
  const x = mm(10)
  const width = A4.width - mm(20)
  line(page, x, mm(25), x + width, mm(25), 0.45, rgb(0.73, 0.73, 0.73))
  const disclaimer = 'เอกสารนี้เป็นสมบัติของกลุ่มงานเทคนิคการแพทย์โรงพยาบาลชลบุรี ห้ามนำออกไปใช้ภายนอกหรือทำซ้ำโดยไม่ได้รับอนุญาต'
  drawCentered(page, disclaimer, x, mm(21), width, fonts.regular, 8)
  drawText(page, 'Fm-QP-LAB-01/03', x + width - mm(24), mm(14), fonts.regular, 8, GRAY)
}

function drawMarker(page: PDFPage, fonts: Fonts) {
  drawText(page, PORTAL_REVISION_HISTORY_MARKER, mm(1), mm(1), fonts.regular, 1, WHITE)
}

function drawWatermark(page: PDFPage, fonts: Fonts) {
  const color = rgb(0.45, 0.6, 0.9)
  const opacity = 0.15
  const line1 = 'กลุ่มงานเทคนิคการแพทย์'
  const line2 = 'โรงพยาบาลชลบุรี'
  const size1 = 44
  const size2 = 40
  const cx = A4.width / 2
  const cy = A4.height / 2
  page.drawText(line1, {
    x: cx - fonts.bold.widthOfTextAtSize(line1, size1) / 2,
    y: cy + size1 * 0.6,
    size: size1, font: fonts.bold, color, opacity,
  })
  page.drawText(line2, {
    x: cx - fonts.bold.widthOfTextAtSize(line2, size2) / 2,
    y: cy - size2 * 0.6,
    size: size2, font: fonts.bold, color, opacity,
  })
}

function drawTableHeader(page: PDFPage, y: number, fonts: Fonts, x: number, colWidths: number[]) {
  const headers = ['ลำดับที่', 'Rev.', 'วันที่แก้ไข', 'รายการแก้ไข', 'ผู้ทำการแก้ไข', 'ผู้อนุมัติ']
  const h = mm(9)
  let cx = x
  for (let i = 0; i < headers.length; i += 1) {
    rect(page, cx, y - h, colWidths[i], h, 0.7, LIGHT_GRAY)
    drawCentered(page, headers[i], cx, y - mm(6.2), colWidths[i], fonts.bold, 12.5)
    cx += colWidths[i]
  }
  return y - h
}

function drawCellText(page: PDFPage, lines: string[], x: number, y: number, width: number, height: number, font: PDFFont, size: number, centered = false) {
  const lineSpacing = mm(5)
  const startY = y - (height - (lines.length - 1) * lineSpacing) / 2 - size * 0.15
  lines.forEach((text, idx) => {
    const yy = startY - idx * lineSpacing
    if (centered) {
      drawCentered(page, text, x + mm(1), yy, width - mm(2), font, size)
    } else {
      drawText(page, text, x + mm(2), yy, font, size)
    }
  })
}

function drawDataRow(page: PDFPage, row: RevisionHistoryRow, rowNo: number, y: number, height: number, fonts: Fonts, x: number, colWidths: number[]) {
  const values = [
    String(rowNo),
    row.revision_number,
    rowDate(row),
    row.revision_note ?? '',
    row.revised_by ?? '',
    row.approved_by ?? '',
  ]
  let cx = x
  for (let i = 0; i < values.length; i += 1) {
    rect(page, cx, y - height, colWidths[i], height, 0.7)
    const maxLines = i === 3 ? 4 : 3
    const lines = wrapText(values[i], fonts.regular, 12.3, colWidths[i] - mm(4), maxLines)
    drawCellText(page, lines.length ? lines : [''], cx, y, colWidths[i], height, fonts.regular, 12.3, i !== 3)
    cx += colWidths[i]
  }
}

function rowHeight(row: RevisionHistoryRow, fonts: Fonts, detailWidth: number, personWidth: number) {
  const lineCounts = [
    wrapText(row.revision_note ?? '', fonts.regular, 12.3, detailWidth - mm(4), 4).length,
    wrapText(row.revised_by ?? '', fonts.regular, 12.3, personWidth - mm(4), 3).length,
    wrapText(row.approved_by ?? '', fonts.regular, 12.3, personWidth - mm(4), 3).length,
  ]
  return Math.max(mm(12), mm(5.2 * Math.max(1, ...lineCounts) + 5))
}

export async function generateRevisionHistoryPdf(input: RevisionHistoryInput) {
  const pdf = await PDFDocument.create()
  const fonts = await loadFonts(pdf)
  const rows = buildRows(input)
  const x = mm(10)
  const colWidths = [mm(15), mm(18), mm(30), mm(118), mm(48), mm(48)]
  const bottomLimit = mm(30)
  let page = pdf.addPage([A4.width, A4.height])
  let y = A4.height - mm(58)
  let rowNo = 1

  const startPage = () => {
    page = pdf.addPage([A4.width, A4.height])
    drawWatermark(page, fonts)
    drawHeader(page, input.document, fonts)
    drawFooter(page, fonts)
    drawMarker(page, fonts)
    y = drawTableHeader(page, A4.height - mm(58), fonts, x, colWidths)
  }

  pdf.removePage(0)
  startPage()

  for (const row of rows) {
    const h = rowHeight(row, fonts, colWidths[3], colWidths[4])
    if (y - h < bottomLimit) startPage()
    drawDataRow(page, row, rowNo, y, h, fonts, x, colWidths)
    y -= h
    rowNo += 1
  }

  if (rows.length === 0) {
    drawDataRow(page, {
      id: 'empty',
      revision_number: '',
      revision_note: '',
      revised_by: '',
      approved_by: '',
      file_url: null,
      file_name: null,
      created_at: '',
    }, 1, y, mm(12), fonts, x, colWidths)
  }

  return pdf.save()
}

export async function loadRevisionHistoryInput(documentId: string, currentOverrides: Record<string, unknown> = {}): Promise<RevisionHistoryInput> {
  const { data: doc, error: docErr } = await supabaseAdmin
    .from('documents')
    .select('id, document_code, title, type, revision, description, owner_name, approver_name, file_url, file_name, edit_date, effective_date, published_at, updated_at, created_at')
    .eq('id', documentId)
    .single()
  if (docErr || !doc) throw new Error(docErr?.message ?? 'Document not found')

  const { data: revisions, error: revisionsErr } = await supabaseAdmin
    .from('document_revisions')
    .select('id, revision_number, revision_note, revised_by, approved_by, file_url, file_name, created_at, history_source')
    .eq('document_id', documentId)
  if (revisionsErr) throw new Error(revisionsErr.message)

  return {
    document: { ...(doc as RevisionHistoryDocument), ...currentOverrides } as RevisionHistoryDocument,
    revisions: (revisions ?? []) as RevisionHistoryRow[],
  }
}

export async function generateRevisionHistoryPdfForDocument(documentId: string, currentOverrides: Record<string, unknown> = {}) {
  return generateRevisionHistoryPdf(await loadRevisionHistoryInput(documentId, currentOverrides))
}

async function trailingPortalHistoryPageCount(pdfBytes: Uint8Array | Buffer) {
  try {
    const { getDocumentProxy, extractText } = await import('unpdf')
    const proxy = await getDocumentProxy(new Uint8Array(pdfBytes))
    const { text } = await extractText(proxy, { mergePages: false })
    const pageTexts = Array.isArray(text) ? text : [String(text)]
    let count = 0
    for (let i = pageTexts.length - 1; i >= 0; i -= 1) {
      if (!String(pageTexts[i] ?? '').includes(PORTAL_REVISION_HISTORY_MARKER)) break
      count += 1
    }
    return count
  } catch {
    return 0
  }
}

export async function removeTrailingPortalRevisionHistory(pdfBytes: Uint8Array | Buffer) {
  const removeCount = await trailingPortalHistoryPageCount(pdfBytes)
  if (removeCount === 0) return new Uint8Array(pdfBytes)
  const source = await PDFDocument.load(pdfBytes)
  const keepCount = Math.max(0, source.getPageCount() - removeCount)
  const output = await PDFDocument.create()
  const pages = await output.copyPages(source, Array.from({ length: keepCount }, (_, i) => i))
  pages.forEach((page) => output.addPage(page))
  return output.save()
}

export async function appendRevisionHistoryPdf(
  pdfBytes: Uint8Array | Buffer,
  historyPdfBytes: Uint8Array | Buffer,
  options: { removeExistingPortalHistory?: boolean } = {},
) {
  const baseBytes = options.removeExistingPortalHistory === false
    ? new Uint8Array(pdfBytes)
    : await removeTrailingPortalRevisionHistory(pdfBytes)
  const output = await PDFDocument.create()
  const base = await PDFDocument.load(baseBytes)
  const history = await PDFDocument.load(historyPdfBytes)
  const basePages = await output.copyPages(base, base.getPageIndices())
  basePages.forEach((page) => output.addPage(page))
  const historyPages = await output.copyPages(history, history.getPageIndices())
  historyPages.forEach((page) => output.addPage(page))
  return output.save()
}
