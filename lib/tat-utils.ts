export function getThaiFiscalYear(date: Date): number {
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  return month >= 10 ? year + 544 : year + 543
}

export function getTATFiscalYearMonth(date: Date): { fiscal_year: number; month: number } {
  return {
    fiscal_year: getThaiFiscalYear(date),
    month: date.getMonth() + 1,
  }
}

export type ColumnMap = {
  received_at?: string
  resulted_at?: string
  test_code?: string
  test_name?: string
  dept_code?: string
  lab_number?: string
}

export function autoDetectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {}
  for (const h of headers) {
    const l = h.toLowerCase()
    if (!map.received_at && /receive|รับ|เวลารับ|recv/i.test(l)) map.received_at = h
    else if (!map.resulted_at && /result|ผล|report|valid|rept/i.test(l)) map.resulted_at = h
    else if (!map.test_code && /\bcode\b|รหัส|test_id/i.test(l)) map.test_code = h
    else if (!map.test_name && /\bname\b|ชื่อ|test_name/i.test(l)) map.test_name = h
    else if (!map.dept_code && /dept|ward|แผนก|section/i.test(l)) map.dept_code = h
    else if (!map.lab_number && /lab|accession|barcode|\bhn\b|\ban\b/i.test(l)) map.lab_number = h
  }
  return map
}

export async function parseTATFile(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer()

  if (file.name.match(/\.xlsx?$/i)) {
    const { read, utils } = await import('xlsx')
    const wb = read(buffer, { type: 'array', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    return utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
  }

  const text = new TextDecoder().decode(buffer)
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []

  const delimiters = ['\t', '|', ',', ';']
  const delimiter = delimiters.find(d => lines[0].includes(d)) ?? '\t'
  const headers = lines[0].split(delimiter).map(h => h.trim())

  return lines.slice(1).map(line => {
    const cells = line.split(delimiter)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim() })
    return row
  })
}

export function formatTAT(minutes: number): string {
  if (minutes < 60) return `${minutes} นาที`
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h} ชม. ${m} นาที` : `${h} ชม.`
  }
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  return h > 0 ? `${d} วัน ${h} ชม.` : `${d} วัน`
}

export function buildHeatmapMatrix(entries: { received_at: string }[]): number[][] {
  const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const e of entries) {
    const d = new Date(e.received_at)
    const dayIndex = (d.getDay() + 6) % 7 // Mon=0 … Sun=6
    const hour = d.getHours()
    matrix[dayIndex][hour]++
  }
  return matrix
}
