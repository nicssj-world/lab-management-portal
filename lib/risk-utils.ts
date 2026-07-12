export type RiskLevel = 'low' | 'medium' | 'high'
export type RiskStatus = 'open' | 'mitigating' | 'monitoring' | 'closed'
export type ReviewStatus = 'pending' | 'reviewed' | 'rca_required' | 'action_plan' | 'follow_up' | 'closed'
export type ActionType = 'correction' | 'corrective' | 'preventive' | 'follow_up'
export type ActionStatus = 'open' | 'in_progress' | 'done'

export const RISK_EVENT_TYPES = [
  { value: 'incident', label: 'Incident / อุบัติการณ์' },
  { value: 'near_miss', label: 'Near Miss' },
  { value: 'nonconformity', label: 'Nonconformity' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'risk_assessment', label: 'Risk Assessment' },
]

export const REPORTER_POSITIONS = [
  'นักเทคนิคการแพทย์',
  'เจ้าพนักงานวิทยาศาสตร์ทางการแพทย์',
  'พนักงานประจำห้องทดลอง',
]

export const LAB_DEPARTMENTS = [
  'งานเคมีคลินิก',
  'งานภูมิคุ้มกันวิทยา',
  'งานโลหิตวิทยา',
  'งานจุลทรรศนศาสตร์คลินิก',
  'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
  'งานบริการผู้ป่วยนอก',
  'งานคลังเลือด',
  'งานอณูชีววิทยา',
  'งานตรวจพิเศษและปฏิบัติการตรวจต่อ',
  'งานจุลชีววิทยา',
  'งานคลังวัสดุวิทยาศาสตร์',
  'งานสำนักงานกลุ่มงานเทคนิคการแพทย์',
  'กลุ่มงานเทคนิคการแพทย์',
]

export const NEAR_MISS_EVENTS = [
  'สิ่งส่งตรวจ Hemolysis',
  'สิ่งส่งตรวจ Turbid',
  'สิ่งส่งตรวจ clot',
  'สิ่งส่งตรวจปริมาตรไม่เพียงพอสำหรับการทดสอบ',
  'ชื่อใบนำส่งตรวจกับสิ่งส่งตรวจไม่ตรงกัน',
  'สิ่งส่งตรวจผิดชนิด หรือ ใส่ภาชนะผิดชนิด',
  'เก็บสิ่งส่งตรวจผิดราย',
  'Request ผิดราย',
  'ไม่ได้รับสิ่งส่งตรวจ',
  'ส่งสิ่งส่งตรวจเกินระยะเวลาที่กำหนด',
  'ติด Barcode ผิดราย',
  'ตัวอย่างไม่ครบตามใบส่งตรวจ',
  'ไม่ติดชื่อสกุลบนภาชนะที่ส่งตรวจ',
  'สิ่งส่งตรวจหก - แตก เลอะ',
  'ระบบ LIS ขัดข้อง',
  'ระบบ HIS ขัดข้อง',
  'Reagent หมดอายุ',
  'อื่นๆ',
]

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
]

export function riskScore(likelihood?: number | null, impact?: number | null) {
  if (!likelihood || !impact) return null
  return likelihood * impact
}

export function riskLevel(score?: number | null): RiskLevel | null {
  if (!score) return null
  if (score >= 15) return 'high'
  if (score >= 8) return 'medium'
  return 'low'
}

export function requiresRca(severity?: string | null) {
  const value = (severity ?? '').trim().toUpperCase()
  return ['D', 'E', 'F', 'G', 'H', 'I'].includes(value)
}

export function mapIorStatusToStatus(value?: string | null): RiskStatus {
  const normalized = (value ?? '').trim().toLowerCase()
  if (!normalized) return 'open'
  if (normalized.includes('ปิด') || normalized.includes('close')) return 'closed'
  if (normalized.includes('approve') || normalized.includes('อนุมัติ') || normalized.includes('rm co')) return 'monitoring'
  return 'mitigating'
}

export function statusLabel(status?: string | null) {
  switch (status) {
    case 'closed': return 'ปิดแล้ว'
    case 'monitoring': return 'รอติดตามผล'
    case 'mitigating': return 'รอแก้ไข'
    default: return 'เปิดอยู่'
  }
}

export function reviewStatusLabel(status?: string | null) {
  switch (status) {
    case 'closed': return 'ปิดประเด็น'
    case 'follow_up': return 'ติดตามผล'
    case 'action_plan': return 'Action plan'
    case 'rca_required': return 'ต้อง RCA'
    case 'reviewed': return 'ทบทวนแล้ว'
    default: return 'รอทบทวน'
  }
}

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
