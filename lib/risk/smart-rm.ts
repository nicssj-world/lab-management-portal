// Smart-RM = ข้อมูลอุบัติการณ์ที่นำเข้าจากระบบ HIS ของโรงพยาบาล ใช้วิเคราะห์อย่างเดียว
// ไม่มี workflow ไม่มีสถานะงาน ไม่มี action plan — จึงต้องไม่ถูกนับรวมใน KPI ของงานห้องแล็บ
//
// ตรรกะแปลงวันที่ทั้งหมดในไฟล์นี้ย้ายมาจาก lib/risk-utils.ts โดยไม่แก้พฤติกรรม
// (มีเทสต์ครอบอยู่ที่ lib/risk/smart-rm.test.ts)

export const SMART_RM_HEADERS = [
  'หมายเลข',
  'วันที่เกิดเหตุ',
  'สถานที่เกิดเหตุ',
  'หน่วยงานที่ต้องการส่งถึง',
  'ประเภทความเสี่ยง',
  'ประเภทของเหตุการณ์ หัวข้อหลัก',
  'ประเภทของเหตุการณ์ หัวข้อย่อย',
  'ระดับความรุนแรง RM',
  'เกิดเหตุการณ์อย่างไร',
  'สถานะ IOR',
  'วันที่บันทึก',
] as const

// Thai Buddhist Era (พ.ศ.) → Christian Era (ค.ศ.): พ.ศ. = ค.ศ. + 543.
// Any 4-digit year > 2400 can only be a BE year in this app's realistic date range (1990–2100 CE).
export function toCeYear(year: number): number {
  return year > 2400 ? year - 543 : year
}

// 2-digit years are ambiguous between short-form BE (e.g. "68" = พ.ศ. 2568) and short-form CE
// (e.g. "26" = ค.ศ. 2026). Pivot at 60: today's BE years run ~2560s+, CE years run ~2020s —
// this will need revisiting once CE years pass 2060, but that's decades out.
export function expandTwoDigitYear(yy: number): number {
  return toCeYear(yy >= 60 ? 2500 + yy : 2000 + yy)
}

// Builds an ISO date only if year/month/day form a real calendar date (rejects e.g. Feb 30,
// which `new Date` would otherwise silently roll over into the next month) and the year falls
// in this app's realistic range.
export function toValidIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 1990 || year > 2100) return null
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  if (!Number.isInteger(day) || day < 1 || day > 31) return null
  const d = new Date(year, month - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Two numeric slots from a date string, in the order they appeared. `firstIsMonth` says which
// slot is month by convention (dash/ISO: month first; slash: day first). If the assumed month
// slot is >12 (invalid) but the other slot could be a valid month, swap — this recovers
// MM/DD-entered dates and inconsistent exports without guessing wrong on unambiguous dates.
function resolveMonthDay(first: number, second: number, firstIsMonth: boolean): { month: number; day: number } | null {
  const month = firstIsMonth ? first : second
  const day = firstIsMonth ? second : first
  if (month >= 1 && month <= 12) return { month, day }
  if (day >= 1 && day <= 12) return { month: day, day: month }
  return null
}

export function parseSmartRmDate(value: unknown) {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return excelSerialDateToIso(value)
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const raw = String(value).trim()
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (slash) {
    const [, day, month, year] = slash  // Thai/European format: DD/MM/YYYY
    const fullYear = year.length === 2 ? expandTwoDigitYear(Number(year)) : toCeYear(Number(year))
    const resolved = resolveMonthDay(Number(day), Number(month), false)
    if (!resolved) return null
    return toValidIsoDate(fullYear, resolved.month, resolved.day)
  }
  const dash = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (dash) {
    const fullYear = toCeYear(Number(dash[1]))
    const resolved = resolveMonthDay(Number(dash[2]), Number(dash[3]), true)
    if (!resolved) return null
    return toValidIsoDate(fullYear, resolved.month, resolved.day)
  }
  return null
}

// Delegates entirely to parseSmartRmDate, which is idempotent: normalizing an already-normalized
// ISO date (year always ≤2400 by that point) is a no-op. This matters because the same value can
// pass through here twice — once client-side during import preview, again server-side on submit.
export function normalizeIsoDate(value: unknown) {
  return parseSmartRmDate(value)
}

function excelSerialDateToIso(serial: number) {
  const utcDays = Math.floor(serial - 25569)
  const date = new Date(utcDays * 86400 * 1000)
  if (Number.isNaN(date.getTime())) return null
  return toValidIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

/** ตัดคำต่อท้ายชื่อหน่วยงานที่ระบบ HIS เติมมา เพื่อให้จับคู่กับชื่อในระบบเราได้ */
export function stripLabSuffix(value?: string | number | null) {
  const text = toText(value)
  if (!text) return null
  return text
    .replace(/\s*กลุ่มงานเทคนิคการแพทย์\s*$/u, '')
    .replace(/\s*\(Lab\)\s*$/u, '')
    .trim() || text
}

export function toText(value: unknown) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

/** ระดับ RM ต้องเป็น A–I เท่านั้น ค่าอื่นถือว่าไม่ระบุ (ตรงกับ check constraint ใน DB) */
export function normalizeSeverity(value: unknown) {
  const text = String(value ?? '').trim().toUpperCase()
  return /^[A-I]$/.test(text) ? text : null
}
