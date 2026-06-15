// Detect values from a controlled-document PDF header (QP / WI format).
// Uses pdfjs assembled text (extractText) so Thai diacritics / tone marks
// that float at different Y coordinates don't break grouping.
// Checks first 2 pages — page 0 might be a previously generated cover.
// Silently returns {} on any error or when labels are not found.

export type DetectedHeader = {
  revision?: string      // e.g. "06"
  effectiveDate?: string // ISO 'YYYY-MM-DD'
  totalPages?: number    // e.g. 5 from "1 / 5"
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
const EN_MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december']
const EN_SHORT  = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

function parseDate(text: string): string | null {
  const s = text.trim()
  for (let i = 0; i < THAI_MONTHS.length; i++) {
    const m = s.match(new RegExp(`(\\d{1,2})\\s*${THAI_MONTHS[i]}\\s*(\\d{4})`))
    if (m) {
      const day  = parseInt(m[1], 10)
      const year = parseInt(m[2], 10) - 543
      return `${year}-${String(i + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  for (let i = 0; i < 12; i++) {
    const m = s.match(new RegExp(`(\\d{1,2})\\s*(?:${EN_MONTHS[i]}|${EN_SHORT[i]})\\s*(\\d{4})`, 'i'))
    if (m) {
      const day  = parseInt(m[1], 10)
      const year = parseInt(m[2], 10)
      return `${year}-${String(i + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  return null
}

function parseFromPageText(text: string): DetectedHeader {
  const result: DetectedHeader = {}

  // แก้ไขครั้งที่ : 06  — any non-digit chars between label and value
  const revM = text.match(/แก้ไขครั้งที่[^0-9]{0,15}(\d+)/)
  if (revM) result.revision = revM[1].trim()

  // หน้าที่ : 1 / 5  — capture the TOTAL (second number after /)
  const pageM = text.match(/หน้าที่[^0-9]{0,15}\d+[^0-9]{1,10}(\d+)/)
  if (pageM) result.totalPages = parseInt(pageM[1], 10)

  // วันที่บังคับใช้ : <date>  — capture up to 50 chars after the label
  const dateM = text.match(/วันที่บังคับใช้(.{0,50})/)
  if (dateM) {
    const parsed = parseDate(dateM[1])
    if (parsed) result.effectiveDate = parsed
  }

  return result
}

export async function detectPdfHeader(buffer: Buffer): Promise<DetectedHeader> {
  try {
    const { getDocumentProxy, extractText } = await import('unpdf')
    const uint = new Uint8Array(buffer)
    const pdf  = await getDocumentProxy(uint)
    const { text: pageTexts } = await extractText(pdf)

    console.log('[detect-header] pages:', pageTexts.length, '| page0 snippet:', pageTexts[0]?.slice(0, 200))

    for (const pageText of pageTexts.slice(0, 2)) {
      const result = parseFromPageText(pageText)
      console.log('[detect-header] parsed:', result, 'from page snippet:', pageText.slice(0, 120))
      if (Object.keys(result).length > 0) return result
    }

    return {}
  } catch (err) {
    console.error('[detect-header] failed:', err instanceof Error ? err.message : String(err))
    return {}
  }
}
