import JSZip from 'jszip'

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

export type DocxHeaderMetadata = {
  documentCode?: string | null
  title?: string | null
  revision?: string | null
  effectiveDate?: string | null
  reviewDate?: string | null
  editDate?: string | null
}

type FieldKey = keyof DocxHeaderMetadata

type HeaderField = {
  key: FieldKey
  canonicalLabel: string
  labels: RegExp[]
}

const HEADER_FIELDS: HeaderField[] = [
  {
    key: 'revision',
    canonicalLabel: 'แก้ไขครั้งที่',
    labels: [/แก้ไข\s*ครั้งที่/i, /ครั้งที่\s*แก้ไข/i, /Revision/i],
  },
  {
    key: 'documentCode',
    canonicalLabel: 'หมายเลขเอกสาร',
    labels: [/หมายเลข\s*เอกสาร/i, /Document\s*No\.?/i],
  },
  {
    key: 'effectiveDate',
    canonicalLabel: 'วันที่บังคับใช้',
    labels: [/วันที่\s*บังคับใช้(?:\s*เอกสาร)?/i, /Effective\s*Date/i],
  },
  {
    key: 'reviewDate',
    canonicalLabel: 'วันที่ทบทวน',
    labels: [/วันที่\s*ทบทวน/i, /Review\s*Date/i],
  },
  {
    key: 'editDate',
    canonicalLabel: 'วันที่แก้ไข/ทบทวนเอกสาร',
    labels: [/วันที่\s*แก้ไข\s*\/?\s*ทบทวน\s*เอกสาร/i, /วันที่\s*แก้ไข\s*เอกสาร/i, /Edit\s*\/?\s*Review\s*Date/i, /Edit\s*Date/i],
  },
  {
    key: 'title',
    canonicalLabel: 'ชื่อเอกสาร',
    labels: [/ชื่อ\s*เอกสาร/i, /เรื่อง/i, /Title/i],
  },
]

const EXTRACT_ORDER: FieldKey[] = ['title', 'documentCode', 'revision', 'editDate', 'reviewDate', 'effectiveDate']

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function textRuns(xml: string) {
  const runs = xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)
  return Array.from(runs, (m) => decodeXml(m[1]))
}

function plainText(xml: string) {
  return textRuns(xml).join('').replace(/\s+/g, ' ').trim()
}

function tableRows(xml: string) {
  return Array.from(xml.matchAll(/<w:tr[\s\S]*?<\/w:tr>/g), (m) => m[0])
}

function tableCells(rowXml: string) {
  return Array.from(rowXml.matchAll(/<w:tc[\s\S]*?<\/w:tc>/g), (m) => m[0])
}

function fieldForCell(text: string) {
  return HEADER_FIELDS.find((field) => field.labels.some((label) => label.test(text)))
}

function valueAfterLabel(text: string, field: HeaderField) {
  let value = text
  for (const label of field.labels) {
    value = value.replace(label, '')
  }
  return value.replace(/^[\s:：\-–—]+/, '').trim()
}

function labelPrefix(text: string, fallback: string) {
  const colon = text.search(/[:：]/)
  if (colon > 0) return text.slice(0, colon).trim() || fallback
  return fallback
}

function normalizeDateForHeader(value: string | null | undefined) {
  const clean = value?.trim()
  if (!clean) return ''

  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const y = Number(iso[1])
    const m = Number(iso[2])
    const d = Number(iso[3])
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d) && m >= 1 && m <= 12) {
      return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`
    }
  }

  const parsed = new Date(clean)
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getDate()} ${THAI_MONTHS[parsed.getMonth()]} ${parsed.getFullYear() + 543}`
  }
  return clean
}

function formatHeaderValue(key: FieldKey, value: string | null | undefined) {
  if (key === 'effectiveDate' || key === 'reviewDate' || key === 'editDate') {
    return normalizeDateForHeader(value)
  }
  return value?.trim() ?? ''
}

function replaceCellText(cellXml: string, text: string) {
  const openTag = cellXml.match(/^<w:tc\b[^>]*>/)?.[0] ?? '<w:tc>'
  const tcPr = cellXml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/)?.[0] ?? ''
  const firstParagraph = cellXml.match(/<w:p[\s\S]*?<\/w:p>/)?.[0] ?? ''
  const pPr = firstParagraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? ''
  const rPr = firstParagraph.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? ''
  const paragraph = `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`
  return `${openTag}${tcPr}${paragraph}</w:tc>`
}

function patchHeaderXml(xml: string, metadata: DocxHeaderMetadata) {
  let patched = xml
  let changed = false

  for (const row of tableRows(xml)) {
    let nextRow = row
    const cells = tableCells(row)
    const cellTexts = cells.map(plainText)

    for (let idx = 0; idx < cells.length; idx++) {
      const text = cellTexts[idx]
      const field = fieldForCell(text)
      if (!field) continue

      const value = formatHeaderValue(field.key, metadata[field.key])
      if (!value) continue

      const existingValue = valueAfterLabel(text, field)
      const nextText = cellTexts[idx + 1] ?? ''
      const labelOnly = !existingValue || existingValue === ':' || existingValue === '：'

      if (labelOnly && idx + 1 < cells.length && !fieldForCell(nextText)) {
        if (nextText.trim() === value) continue
        const nextCell = replaceCellText(cells[idx + 1], value)
        nextRow = nextRow.replace(cells[idx + 1], nextCell)
      } else {
        if (existingValue === value) continue
        const label = labelPrefix(text, field.canonicalLabel)
        const nextCell = replaceCellText(cells[idx], `${label} : ${value}`)
        nextRow = nextRow.replace(cells[idx], nextCell)
      }
    }

    if (nextRow !== row) {
      patched = patched.replace(row, nextRow)
      changed = true
    }
  }

  return { xml: patched, changed }
}

export async function extractDocxHeaderMetadata(buffer: Buffer): Promise<{ text: string; fields: Partial<Record<FieldKey, string>> }> {
  const zip = await JSZip.loadAsync(buffer)
  const headerNames = Object.keys(zip.files)
    .filter((name) => /^word\/header\d+\.xml$/.test(name))
    .sort()
  const fields: Partial<Record<FieldKey, string>> = {}

  for (const name of headerNames) {
    const xml = await zip.file(name)?.async('string')
    if (!xml) continue

    for (const row of tableRows(xml)) {
      const cells = tableCells(row)
      const cellTexts = cells.map(plainText)

      for (let idx = 0; idx < cells.length; idx++) {
        const field = fieldForCell(cellTexts[idx])
        if (!field || fields[field.key]) continue

        const sameCellValue = valueAfterLabel(cellTexts[idx], field)
        const nextCellValue = cellTexts[idx + 1]?.trim() ?? ''
        const value = sameCellValue || nextCellValue
        if (value) fields[field.key] = value
      }
    }
  }

  const lines = EXTRACT_ORDER
    .map((key) => {
      const value = fields[key]
      if (!value) return null
      const label = HEADER_FIELDS.find((field) => field.key === key)?.canonicalLabel ?? key
      return `${label} : ${value}`
    })
    .filter((line): line is string => Boolean(line))

  return { text: lines.join('\n'), fields }
}

export async function patchDocxHeaderMetadata(buffer: Buffer, metadata: DocxHeaderMetadata): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer)
  const headerNames = Object.keys(zip.files)
    .filter((name) => /^word\/header\d+\.xml$/.test(name))
    .sort()

  let changed = false
  for (const name of headerNames) {
    const file = zip.file(name)
    const xml = await file?.async('string')
    if (!xml) continue
    const patched = patchHeaderXml(xml, metadata)
    if (patched.changed) {
      zip.file(name, patched.xml)
      changed = true
    }
  }

  if (!changed) return buffer
  const output = await zip.generateAsync({ type: 'nodebuffer' })
  return Buffer.from(output)
}

export function isDocxFile(file: File | { name?: string; type?: string } | null | undefined) {
  if (!file) return false
  return file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || /\.docx$/i.test(file.name ?? '')
}
