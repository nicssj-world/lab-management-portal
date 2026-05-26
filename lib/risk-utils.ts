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

export function parseSmartRmDate(value: unknown) {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return excelSerialDateToIso(value)
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const raw = String(value).trim()
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (slash) {
    const [, day, month, year] = slash  // Thai/European format: DD/MM/YYYY
    const fullYear = year.length === 2 ? String(2000 + Number(year)) : year
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  const dash = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (dash) return `${dash[1]}-${dash[2].padStart(2, '0')}-${dash[3].padStart(2, '0')}`
  return null
}

export function normalizeIsoDate(value: unknown) {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return excelSerialDateToIso(value)
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const raw = String(value).trim()
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    const y = iso[1]
    const a = Number(iso[2])
    const b = Number(iso[3])
    if (a > 12 && b <= 12) return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`
    return `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
  }
  return parseSmartRmDate(value)
}

function excelSerialDateToIso(serial: number) {
  const utcDays = Math.floor(serial - 25569)
  const date = new Date(utcDays * 86400 * 1000)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}
