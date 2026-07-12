export interface ReadLogSummaryDocument {
  title: string
  document_code: string
  type: string
}

export interface ReadLogSummaryReader {
  userId: string
  name: string
  position?: string | null
  role?: string | null
  lastRead: string
}

const TYPE_LABEL: Record<string, string> = {
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

const ROWS_PER_PAGE = 25

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function positionLabel(role: string | null | undefined): string {
  if (role === 'Manager' || role === 'Medical Technologist' || role === 'Document Controller' || role === 'Admin') return 'นักเทคนิคการแพทย์'
  if (role === 'Assistant') return 'พนักงานประจำห้องทดลอง'
  if (role === 'Medical Science Technician') return 'เจ้าพนักงานวิทยาศาสตร์การแพทย์'
  return ''
}

function formatReadDateTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function uniqueLatestReaders(readers: ReadLogSummaryReader[]): ReadLogSummaryReader[] {
  const seen = new Map<string, ReadLogSummaryReader>()
  for (const reader of readers) {
    const current = seen.get(reader.userId)
    if (!current || new Date(reader.lastRead) > new Date(current.lastRead)) {
      seen.set(reader.userId, reader)
    }
  }
  return Array.from(seen.values()).sort((a, b) => new Date(a.lastRead).getTime() - new Date(b.lastRead).getTime())
}

export function buildReadLogSummaryHtml(doc: ReadLogSummaryDocument, readers: ReadLogSummaryReader[]): string {
  const unique = uniqueLatestReaders(readers)
  const pages: ReadLogSummaryReader[][] = []
  for (let i = 0; i < Math.max(unique.length, 1); i += ROWS_PER_PAGE) {
    pages.push(unique.slice(i, i + ROWS_PER_PAGE))
  }

  const headerBlock = `
      <div class="page-header">
        <div class="main-title">แบบบันทึกการลงชื่อรับทราบ การศึกษาและทำความเข้าใจเอกสารคุณภาพ</div>
        <div class="sub-title">กลุ่มงานเทคนิคการแพทย์โรงพยาบาลชลบุรี</div>
        <div class="doc-meta">ประเภทเอกสาร ${escapeHtml(TYPE_LABEL[doc.type] ?? doc.type)}</div>
        <div class="doc-meta">เรื่อง ${escapeHtml(doc.title)}&nbsp;&nbsp;&nbsp;รหัส ${escapeHtml(doc.document_code)}</div>
      </div>`

  const theadHtml = '<thead><tr><th class="col-no">ลำดับที่</th><th class="col-name">ชื่อ-สกุล</th><th class="col-pos">ตำแหน่ง</th><th class="col-date">วันที่ - เวลา</th></tr></thead>'

  let rowIdx = 1
  const pagesHtml = pages.map((page, pageIndex) => {
    const isLastPage = pageIndex === pages.length - 1
    const filledRows: Array<ReadLogSummaryReader | null> = [...page]
    if (!isLastPage) {
      while (filledRows.length < ROWS_PER_PAGE) filledRows.push(null)
    }

    const tbodyHtml = filledRows.map((reader) => {
      if (!reader) return '<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>'
      const position = reader.position || positionLabel(reader.role)
      return `<tr><td class="center">${rowIdx++}</td><td>${escapeHtml(reader.name)}</td><td class="center">${escapeHtml(position)}</td><td class="center">${escapeHtml(formatReadDateTime(reader.lastRead))}</td></tr>`
    }).join('')

    return `
        <div class="page">
          ${headerBlock}
          <table>${theadHtml}<tbody>${tbodyHtml}</tbody></table>
          <div class="page-footer">
            <span class="footer-spacer"></span>
            <span class="footer-center">เอกสารนี้เป็นสมบัติของกลุ่มงานเทคนิคการแพทย์โรงพยาบาลชลบุรี ห้ามนำออกไปใช้ภายนอกหรือทำซ้ำโดยไม่ได้รับอนุญาต</span>
            <span class="footer-right">Fm-QP-LAB-01/05</span>
          </div>
        </div>`
  }).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fm-QP-LAB-01-05</title><style>
      @page { size: A4 portrait; margin: 12mm 15mm 12mm 15mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'TH Sarabun New', 'Sarabun', 'Cordia New', Arial, sans-serif; font-size: 14pt; color: #000; }
      .page { page-break-after: always; display: flex; flex-direction: column; height: 273mm; }
      .page:last-child { page-break-after: avoid; }
      .page-header { text-align: center; margin-bottom: 8px; flex-shrink: 0; }
      .main-title { font-size: 17pt; font-weight: bold; line-height: 1.5; }
      .sub-title { font-size: 16pt; font-weight: bold; line-height: 1.5; }
      .doc-meta { font-size: 14pt; font-weight: bold; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; flex-shrink: 0; }
      th, td { border: 1.5px solid #000; padding: 3px 6px; font-size: 13pt; height: 26px; }
      th { background: #f5f5f5; font-weight: bold; text-align: center; }
      .col-no { width: 10%; text-align: center; }
      .col-name { width: 30%; }
      .col-pos { width: 30%; text-align: center; }
      .col-date { width: 30%; text-align: center; }
      .center { text-align: center; }
      .page-footer { display: flex; align-items: center; font-size: 10.5pt; color: #555; margin-top: auto; padding-top: 4px; border-top: 1px solid #bbb; }
      .footer-spacer { flex: 1; }
      .footer-center { flex: 0 1 auto; text-align: center; }
      .footer-right { flex: 1; text-align: right; white-space: nowrap; }
    </style></head><body>${pagesHtml}</body></html>`
}
