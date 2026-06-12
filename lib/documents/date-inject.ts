import { sarabunBase64 } from '@/lib/fonts/sarabun-base64'

// ── Date formatters ──────────────────────────────────────────────────────────

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toThaiDate(d: Date): string {
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

function toEnDate(d: Date): string {
  return `${d.getDate()} ${EN_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// ── Eligibility ──────────────────────────────────────────────────────────────

function shouldInject(documentCode: string): boolean {
  const prefix = documentCode.split('-')[0]?.toUpperCase() ?? ''
  return prefix === 'QM' || prefix === 'QP' || prefix === 'WI'
}

// ── DOCX injection ───────────────────────────────────────────────────────────

function stripXmlTags(s: string): string {
  return s.replace(/<[^>]+>/g, '')
}

/** Replace the <w:sdtContent> of the first content-control in `rowXml` that
 *  still shows the "Click or tap" placeholder. Returns the modified row XML,
 *  or the original if the placeholder is not found (already filled).
 *
 *  Handles both block-level SDTs (sdtContent contains <w:p>) and inline SDTs
 *  (sdtContent contains <w:r> directly). Using the wrong wrapper causes blank lines. */
function replaceSdtInRow(rowXml: string, dateStr: string): string {
  // Guard: only act when the placeholder is still active
  if (!rowXml.includes('<w:showingPlcHdr/>') && !rowXml.includes('<w:showingPlcHdr />')) return rowXml
  if (!rowXml.toLowerCase().includes('click')) return rowXml

  let replaced = false
  return rowXml.replace(/<w:sdt\b[\s\S]*?<\/w:sdt>/g, (sdt) => {
    if (replaced) return sdt
    if (!sdt.includes('<w:showingPlcHdr') || !sdt.toLowerCase().includes('click')) return sdt
    replaced = true

    // Detect whether this is a block-level SDT (sdtContent has <w:p>) or inline (<w:r>)
    const sdtContentInner = (sdt.match(/<w:sdtContent>([\s\S]*?)<\/w:sdtContent>/) ?? [])[1] ?? ''
    const isBlock = /<w:p\b/.test(sdtContentInner)

    let newContent: string
    if (isBlock) {
      // Preserve paragraph properties to keep original spacing
      const pPr = (sdtContentInner.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) ?? [])[0] ?? ''
      newContent =
        `<w:sdtContent><w:p>${pPr}<w:r>` +
        `<w:rPr><w:b/><w:lang w:val="th-TH"/></w:rPr>` +
        `<w:t xml:space="preserve">${dateStr}</w:t>` +
        `</w:r></w:p></w:sdtContent>`
    } else {
      // Inline SDT — must use <w:r> directly, no <w:p> wrapper (would create a blank line)
      newContent =
        `<w:sdtContent><w:r>` +
        `<w:rPr><w:b/><w:lang w:val="th-TH"/></w:rPr>` +
        `<w:t xml:space="preserve">${dateStr}</w:t>` +
        `</w:r></w:sdtContent>`
    }

    // Remove <w:showingPlcHdr/> from sdtPr
    const noPlaceholder = sdt
      .replace(/<w:showingPlcHdr\s*\/>/g, '')
      .replace(/<w:showingPlcHdr\s*><\/w:showingPlcHdr>/g, '')
    // Replace sdtContent
    return noPlaceholder.replace(/<w:sdtContent>[\s\S]*?<\/w:sdtContent>/, newContent)
  })
}

interface DocxField {
  label: string
  dateStr: string
}

function injectDocxDates(buffer: Buffer, fields: DocxField[]): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PizZip = require('pizzip') as new (data: Buffer) => {
    file(name: string): { asText(): string } | null
    file(name: string, content: string): void
    generate(opts: { type: string }): Buffer
  }

  const zip = new PizZip(buffer)
  const xmlFile = zip.file('word/document.xml')
  if (!xmlFile) return buffer

  let xml = xmlFile.asText()

  // Split into table rows, process each, rejoin
  const parts = xml.split(/(?=<w:tr[ >])/g)

  let changed = false
  for (const field of fields) {
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i].startsWith('<w:tr')) continue
      const plain = stripXmlTags(parts[i])
      if (!plain.includes(field.label)) continue
      const before = parts[i]
      parts[i] = replaceSdtInRow(parts[i], field.dateStr)
      if (parts[i] !== before) changed = true
      break // each label appears once
    }
  }

  if (!changed) return buffer
  xml = parts.join('')
  zip.file('word/document.xml', xml)
  return zip.generate({ type: 'nodebuffer' }) as unknown as Buffer
}

// ── PDF injection ────────────────────────────────────────────────────────────

interface PdfField {
  label: string
  dateStr: string
  /** Positional fallback index into signature-area "Click or tap" items (sorted top→bottom).
   *  0 = first (topmost), -1 = last (bottommost). Used when Thai text extraction can't find `label`. */
  sigSlot?: number
}

interface TextItem {
  str: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
}

type Overlay = { x: number; y: number; w: number; h: number; fontSize: number; text: string }

/** Group text items into lines by Y proximity, sort each group by X.
 *  Thai PDFs often split one word into many small items; concatenate them before label search. */
function buildLineGroups(items: TextItem[], yTol = 3): { y: number; items: TextItem[]; text: string }[] {
  const groups: { y: number; items: TextItem[] }[] = []
  for (const item of items) {
    const g = groups.find(({ y }) => Math.abs(y - item.y) < yTol)
    if (g) g.items.push(item)
    else groups.push({ y: item.y, items: [item] })
  }
  for (const g of groups) g.items.sort((a, b) => a.x - b.x)
  return groups.map((g) => ({ ...g, text: g.items.map((i) => i.str).join('') }))
}

async function injectPdfDates(buffer: Buffer, fields: PdfField[]): Promise<Buffer> {
  const { getDocumentProxy, extractTextItems } = await import('unpdf')
  const { PDFDocument, rgb } = await import('pdf-lib')

  // Load once — used for AcroForm detection AND final drawing
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true } as Parameters<typeof PDFDocument.load>[1])

  // Text extraction for label-based position finding
  const uint = new Uint8Array(buffer)
  const pdf = await getDocumentProxy(uint)
  const { items: itemsByPage } = await extractTextItems(pdf)
  const rawItems = (itemsByPage[0] ?? []) as TextItem[]
  const lines = buildLineGroups(rawItems, 6)

  console.log('[date-inject:pdf] items:', rawItems.length, '| lines:', lines.length)
  console.log('[date-inject:pdf] lines:', lines.map(l => `"${l.text.slice(0, 40)}"@y=${l.y?.toFixed(0)}`))

  // AcroForm field rectangles — covers PDFs where "Click or tap" is a form widget, not plain text
  interface FRect { x: number; y: number; width: number; height: number; cy: number }
  const formRects: FRect[] = []
  try {
    const form = pdfDoc.getForm()
    for (const f of form.getFields()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const widgets = (f as any).acroField.getWidgets() as any[]
      for (const w of widgets) {
        const r = w.getRectangle() as { x: number; y: number; width: number; height: number }
        formRects.push({ ...r, cy: r.y + r.height / 2 })
      }
    }
    console.log('[date-inject:pdf] AcroForm rects:', formRects.length, formRects.map(r => `(${r.x.toFixed(0)},${r.y.toFixed(0)},${r.width.toFixed(0)}×${r.height.toFixed(0)})`))
  } catch {
    console.log('[date-inject:pdf] no AcroForm fields')
  }

  // Placeholder detection (text-based)
  const isPhLine = (t: string) => t.includes('Click') || t.includes('คลิก') || t.includes('ป้อน') || t.includes('กรอก')
  const phLines = lines.filter(l => isPhLine(l.text)).sort((a, b) => b.y - a.y)
  console.log('[date-inject:pdf] placeholder lines:', phLines.length)

  // Signature-section boundary via English anchors
  const enAnchorYs = lines.filter(l => l.text.includes('Edit Date') || l.text.includes('Effective Date')).map(l => l.y)
  const metaBottomY = enAnchorYs.length > 0 ? Math.min(...enAnchorYs) : null
  const sigPh = metaBottomY !== null ? phLines.filter(l => l.y < metaBottomY - 15) : phLines
  const sigRects = (metaBottomY !== null ? formRects.filter(r => r.cy < metaBottomY - 15) : formRects)
    .sort((a, b) => b.cy - a.cy)

  const usedY = new Set<number>()

  function overlayAt(items: TextItem[], dateStr: string): Overlay | null {
    const fresh = items.filter(it => !usedY.has(Math.round(it.y)))
    if (fresh.length === 0) return null
    const xMin = Math.min(...fresh.map(t => t.x))
    const yMin = Math.min(...fresh.map(t => t.y))
    const xMax = Math.max(...fresh.map(t => t.x + (t.width || 0)))
    const h    = Math.max(...fresh.map(t => t.height)) || 10
    const fs   = fresh.find(t => t.fontSize > 0)?.fontSize ?? 10
    fresh.forEach(t => usedY.add(Math.round(t.y)))
    return { x: xMin, y: yMin, w: Math.max(xMax - xMin, 50), h, fontSize: fs, text: dateStr }
  }

  function overlayAtRect(r: FRect, dateStr: string): Overlay {
    usedY.add(Math.round(r.cy))
    return { x: r.x + 2, y: r.y + 2, w: Math.max(r.width - 4, 50), h: Math.max(r.height - 4, 10), fontSize: 10, text: dateStr }
  }

  const overlays: Overlay[] = []

  for (const field of fields) {
    const anchorLine = lines.find(l => l.text.includes(field.label))
    if (anchorLine) {
      const avgFs = anchorLine.items.reduce((s, i) => s + i.fontSize, 0) / (anchorLine.items.length || 1) || 10
      const yBand = Math.max(avgFs * 5, 30)

      // labelMaxX: right edge of label-only items (exclude placeholder items so we don't
      // accidentally include the placeholder's width when label+placeholder share a line group).
      const labelOnlyItems = anchorLine.items.filter(it => !isPhLine(it.str))
      const labelMaxX = labelOnlyItems.length > 0
        ? Math.max(...labelOnlyItems.map(i => i.x + (i.width || 0)))
        : Math.max(...anchorLine.items.map(i => i.x + (i.width || 0)))

      // S1a: nearest placeholder line to the label.
      // Keep only items to the RIGHT of the label — avoids clobbering the label text
      // when the label and placeholder land in the same line group (same Y).
      const nearPh = phLines
        .filter(l => Math.abs(l.y - anchorLine.y) < yBand && !usedY.has(Math.round(l.y)))
        .sort((a, b) => Math.abs(a.y - anchorLine.y) - Math.abs(b.y - anchorLine.y))
      if (nearPh.length > 0) {
        const rightOfLabel = nearPh[0].items.filter(it => it.x > labelMaxX + 2)
        const targetItems  = rightOfLabel.length > 0 ? rightOfLabel : nearPh[0].items
        const ov = overlayAt(targetItems, field.dateStr)
        if (ov) { overlays.push(ov); continue }
      }

      // S1b: nearest AcroForm rect to the label
      const nearRect = formRects
        .filter(r => Math.abs(r.cy - anchorLine.y) < yBand && !usedY.has(Math.round(r.cy)))
        .sort((a, b) => Math.abs(a.cy - anchorLine.y) - Math.abs(b.cy - anchorLine.y))
      if (nearRect.length > 0) {
        overlays.push(overlayAtRect(nearRect[0], field.dateStr))
        continue
      }

      // S1c: items to the RIGHT of the label (no placeholder text anywhere in PDF)
      const rightItems = rawItems.filter(it =>
        Math.abs(it.y - anchorLine.y) < yBand && it.x > labelMaxX + 5
      )
      if (rightItems.length > 0) {
        const rightLines = buildLineGroups(rightItems, 6)
          .sort((a, b) => Math.abs(a.y - anchorLine.y) - Math.abs(b.y - anchorLine.y))
        const ov = overlayAt(rightLines[0].items, field.dateStr)
        if (ov) { overlays.push(ov); continue }
      }
    }

    // S2: sigSlot positional fallback (Thai signature rows may not extract as text)
    if (field.sigSlot !== undefined) {
      if (sigPh.length > 0) {
        const idx = field.sigSlot >= 0 ? field.sigSlot : sigPh.length + field.sigSlot
        if (idx >= 0 && idx < sigPh.length) {
          // Prefer placeholder-only items within the line to avoid overlaying the label
          const sigOnlyItems = sigPh[idx].items.filter(it => isPhLine(it.str))
          const ov = overlayAt(sigOnlyItems.length > 0 ? sigOnlyItems : sigPh[idx].items, field.dateStr)
          if (ov) { overlays.push(ov); continue }
        }
      }
      if (sigRects.length > 0) {
        const idx = field.sigSlot >= 0 ? field.sigSlot : sigRects.length + field.sigSlot
        if (idx >= 0 && idx < sigRects.length && !usedY.has(Math.round(sigRects[idx].cy))) {
          overlays.push(overlayAtRect(sigRects[idx], field.dateStr))
        }
      }
    }
  }

  console.log('[date-inject:pdf] overlays resolved:', overlays.length, overlays.map(o => `"${o.text}"@(${o.x.toFixed(0)},${o.y.toFixed(0)})`))
  if (overlays.length === 0) return buffer

  const page = pdfDoc.getPages()[0]
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  pdfDoc.registerFontkit(require('@pdf-lib/fontkit'))
  const fontBytes = Buffer.from(sarabunBase64, 'base64')
  const font = await pdfDoc.embedFont(fontBytes)

  for (const ov of overlays) {
    page.drawRectangle({
      x: ov.x - 1, y: ov.y - 2,
      width: Math.max(ov.w + 12, 80), height: ov.h + 4,
      color: rgb(1, 1, 1),
    })
    const textOpts = { size: Math.max(ov.fontSize, 9), font, color: rgb(0, 0, 0) }
    page.drawText(ov.text, { x: ov.x + 0.35, y: ov.y + 1, ...textOpts })
    page.drawText(ov.text, { x: ov.x,        y: ov.y + 1, ...textOpts })
  }

  return Buffer.from(await pdfDoc.save())
}

// ── Field routing ────────────────────────────────────────────────────────────

const UPLOAD_DOCX_FIELDS = (date: Date): DocxField[] => [
  { label: 'วันที่แก้ไขเอกสาร', dateStr: toThaiDate(date) },
  { label: '(Edit Date)',        dateStr: toEnDate(date) },
  { label: 'จัดทำโดย',           dateStr: toThaiDate(date) },
]

const UPLOAD_PDF_FIELDS = (date: Date): PdfField[] => [
  { label: 'วันที่แก้ไขเอกสาร', dateStr: toThaiDate(date) },
  { label: 'Edit Date',          dateStr: toEnDate(date) },
]

const APPROVED_PDF_FIELDS = (date: Date): PdfField[] => [
  // sigSlot: 0 = first remaining signature "Click or tap" (top = รับรองโดย after DOCX upload filled จัดทำโดย)
  { label: 'รับรองโดย', sigSlot: 0, dateStr: toThaiDate(date) },
]

const APPROVED_DOCX_FIELDS = (date: Date): DocxField[] => [
  { label: 'รับรองโดย', dateStr: toThaiDate(date) },
]

const PUBLISHED_PDF_FIELDS = (date: Date): PdfField[] => [
  { label: 'วันที่บังคับใช้เอกสาร', dateStr: toThaiDate(date) },
  { label: 'Effective Date',         dateStr: toEnDate(date) },
  // sigSlot: -1 = last remaining signature "Click or tap" (bottom = อนุมัติโดย)
  { label: 'อนุมัติโดย', sigSlot: -1, dateStr: toThaiDate(date) },
]

const PUBLISHED_DOCX_FIELDS = (date: Date): DocxField[] => [
  { label: 'วันที่บังคับใช้เอกสาร', dateStr: toThaiDate(date) },
  { label: '(Effective Date)',        dateStr: toEnDate(date) },
  { label: 'อนุมัติโดย',              dateStr: toThaiDate(date) },
]

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Inject dates into a QM/QP/WI cover-page document.
 * Returns the original buffer unchanged if:
 *  - document code is not QM/QP/WI
 *  - the placeholder has already been filled by the user
 *  - any error occurs during injection
 */
export async function injectCoverDates(
  buffer: Buffer,
  mimeType: string,
  documentCode: string,
  trigger: 'upload' | 'approved' | 'published',
  date: Date = new Date(),
): Promise<Buffer<ArrayBuffer>> {
  const cast = (b: Buffer): Buffer<ArrayBuffer> => b as Buffer<ArrayBuffer>

  if (!shouldInject(documentCode)) return cast(buffer)

  const isPdf = mimeType === 'application/pdf' || mimeType.includes('pdf')
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType.includes('wordprocessingml')

  try {
    if (trigger === 'upload') {
      if (isDocx) return cast(injectDocxDates(buffer, UPLOAD_DOCX_FIELDS(date)))
      if (isPdf)  return cast(await injectPdfDates(buffer, UPLOAD_PDF_FIELDS(date)))
    } else if (trigger === 'approved') {
      if (isPdf)  return cast(await injectPdfDates(buffer, APPROVED_PDF_FIELDS(date)))
      if (isDocx) return cast(injectDocxDates(buffer, APPROVED_DOCX_FIELDS(date)))
    } else if (trigger === 'published') {
      if (isPdf)  return cast(await injectPdfDates(buffer, PUBLISHED_PDF_FIELDS(date)))
      if (isDocx) return cast(injectDocxDates(buffer, PUBLISHED_DOCX_FIELDS(date)))
    }
  } catch (err) {
    console.error('[date-inject] injection failed:', trigger, documentCode, err instanceof Error ? err.message : String(err))
  }

  return cast(buffer)
}
