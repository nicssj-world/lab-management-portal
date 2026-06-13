import JSZip from 'jszip'
import type { DocxHeaderMetadata } from '@/lib/documents/docx-header'

type FieldKey = keyof DocxHeaderMetadata

type HeaderField = {
  key: FieldKey
  canonicalLabel: string
  labels: RegExp[]
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

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
    labels: [/วันที่\s*แก้ไข\s*\/?\s*ทบทวน\s*เอกสาร/i, /วันที่\s*แก้ไข\s*เอกสาร/i, /วันที่\s*แก้ไข/i, /Edit\s*\/?\s*Review\s*Date/i, /Edit\s*Date/i],
  },
  {
    key: 'title',
    canonicalLabel: 'ชื่อเอกสาร',
    labels: [/ชื่อ\s*เอกสาร/i, /เรื่อง/i, /Title/i],
  },
]

const EXTRACT_ORDER: FieldKey[] = ['title', 'documentCode', 'revision', 'editDate', 'reviewDate', 'effectiveDate']
const HEADER_FOOTER_TAGS = ['oddHeader', 'evenHeader', 'firstHeader', 'oddFooter', 'evenFooter', 'firstFooter']
const ALL_LABELS = HEADER_FIELDS.flatMap((field) => field.labels.map((label) => label.source)).join('|')

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

function cleanExcelHeaderText(value: string) {
  return decodeXml(value)
    .replace(/_x000D_|_x000A_/gi, '\n')
    .replace(/&"[^"]*"/g, '')
    .replace(/&K[0-9A-F]{6}/gi, '')
    .replace(/&\d+/g, '')
    .replace(/&[LCR]/g, '\n')
    .replace(/&[A-Z]/g, '')
    .replace(/&&/g, '&')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()
}

function headerFooterValues(xml: string) {
  const values: string[] = []
  for (const tag of HEADER_FOOTER_TAGS) {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g')
    for (const match of xml.matchAll(re)) {
      values.push(match[1])
    }
  }
  return values
}

function extractField(text: string, field: HeaderField) {
  for (const label of field.labels) {
    const re = new RegExp(`(?:${label.source})\\s*[:：]?\\s*([\\s\\S]*?)(?=\\s*(?:${ALL_LABELS})\\s*[:：]?|\\n|$)`, 'i')
    const match = text.match(re)
    const value = match?.[1]?.replace(/^[\s:：-]+/, '').trim()
    if (value) return value
  }
  return undefined
}

function splitTail(value: string) {
  const tailMatch = value.match(/(\s*(?:_x000D_|_x000A_|\r|\n|&[LCR]|&[A-Z]).*)$/i)
  if (!tailMatch?.index) return { body: value.trimEnd(), tail: '' }
  return {
    body: value.slice(0, tailMatch.index).trimEnd(),
    tail: tailMatch[1],
  }
}

function patchHeaderFooterText(value: string, metadata: DocxHeaderMetadata) {
  let patched = decodeXml(value)
  let changed = false

  for (const field of HEADER_FIELDS) {
    const nextValue = formatHeaderValue(field.key, metadata[field.key])
    if (!nextValue) continue

    for (const label of field.labels) {
      const re = new RegExp(`((?:${label.source})\\s*[:：]?\\s*)([^\\r\\n&]*)`, 'i')
      if (!re.test(patched)) continue

      patched = patched.replace(re, (_match, prefix: string, oldValue: string) => {
        const { tail } = splitTail(oldValue)
        changed = true
        return `${prefix}${nextValue}${tail}`
      })
      break
    }
  }

  return { text: changed ? escapeXml(patched) : value, changed }
}

function patchWorksheetXml(xml: string, metadata: DocxHeaderMetadata) {
  let patched = xml
  let changed = false

  for (const tag of HEADER_FOOTER_TAGS) {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g')
    patched = patched.replace(re, (match, value: string) => {
      const next = patchHeaderFooterText(value, metadata)
      if (!next.changed) return match
      changed = true
      return `<${tag}>${next.text}</${tag}>`
    })
  }

  return { xml: patched, changed }
}

export async function extractXlsxHeaderMetadata(buffer: Buffer): Promise<{ text: string; fields: Partial<Record<FieldKey, string>> }> {
  const zip = await JSZip.loadAsync(buffer)
  const worksheetNames = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort()
  const fields: Partial<Record<FieldKey, string>> = {}

  for (const name of worksheetNames) {
    const xml = await zip.file(name)?.async('string')
    if (!xml) continue

    for (const value of headerFooterValues(xml)) {
      const text = cleanExcelHeaderText(value)
      if (!text) continue
      for (const field of HEADER_FIELDS) {
        if (fields[field.key]) continue
        const extracted = extractField(text, field)
        if (extracted) fields[field.key] = extracted
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

export async function patchXlsxHeaderMetadata(buffer: Buffer, metadata: DocxHeaderMetadata): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer)
  const worksheetNames = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort()

  let changed = false
  for (const name of worksheetNames) {
    const file = zip.file(name)
    const xml = await file?.async('string')
    if (!xml) continue
    const patched = patchWorksheetXml(xml, metadata)
    if (patched.changed) {
      zip.file(name, patched.xml)
      changed = true
    }
  }

  if (!changed) return buffer
  const output = await zip.generateAsync({ type: 'nodebuffer' })
  return Buffer.from(output)
}

export function isXlsxFile(file: File | { name?: string; type?: string } | null | undefined) {
  if (!file) return false
  return file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || /\.xlsx$/i.test(file.name ?? '')
}
