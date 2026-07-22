// แหล่งเดียวของการแมป "ความหมาย → ภาพ" ของโมดูลความเสี่ยง
// ทุก client ใน components/risk/ ต้อง import จากไฟล์นี้ ห้ามประกาศแผนที่สีซ้ำในไฟล์ตัวเอง
//
// กติกาสำคัญ: ห้ามสื่อความหมายด้วยสีอย่างเดียว ทุกตัวบ่งชี้ต้องมีอย่างน้อย 2 ช่องทาง
// (สี + ตัวอักษร หรือ สี + ไอคอน) เพื่อให้อ่านได้เมื่อพิมพ์ขาวดำและสำหรับผู้ที่ตาบอดสี

import type { CSSProperties } from 'react'
import type { BadgeColor } from '@/components/ui/Badge'

// ── ระยะและขนาดตัวอักษร ─────────────────────────────────────────────────────
// density 8/10 (dashboard) — ใช้สเกลนี้ตลอดโมดูล อย่าใส่ค่าตามใจ
export const SPACE = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 } as const
export const FONT = { xs: 11, sm: 11.5, base: 12.5, md: 13, lg: 14, xl: 20, xxl: 25 } as const

// ── Severity A–I (ใช้กับ IOR และ Smart-RM เท่านั้น) ─────────────────────────
export const SEVERITY_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const
export type SeverityLetter = (typeof SEVERITY_LETTERS)[number]

export const SEVERITY_DESCRIPTIONS: Record<SeverityLetter, string> = {
  A: 'เหตุการณ์ที่มีโอกาสเกิดความคลาดเคลื่อน',
  B: 'เกิดความคลาดเคลื่อนแต่ยังไม่ถึงผู้ป่วย',
  C: 'ถึงผู้ป่วยแต่ไม่เกิดอันตราย',
  D: 'ต้องเฝ้าระวังเพื่อให้มั่นใจว่าไม่เกิดอันตราย',
  E: 'เกิดอันตรายชั่วคราว ต้องได้รับการรักษา',
  F: 'เกิดอันตรายชั่วคราว ต้องนอนโรงพยาบาลนานขึ้น',
  G: 'เกิดอันตรายถาวร',
  H: 'ต้องช่วยชีวิต',
  I: 'เสียชีวิต',
}

// A–C ไม่ถึงผู้ป่วยหรือไม่เกิดอันตราย / D–F อันตรายชั่วคราว / G–I อันตรายถาวรขึ้นไป
export function severityTone(severity?: string | null): BadgeColor {
  const value = String(severity ?? '').trim().toUpperCase()
  if (['G', 'H', 'I'].includes(value)) return 'red'
  if (['D', 'E', 'F'].includes(value)) return 'amber'
  if (['A', 'B', 'C'].includes(value)) return 'green'
  return 'gray'
}

// ตั้งแต่ D ขึ้นไปต้องวิเคราะห์รากของปัญหา (เกณฑ์เดิมของระบบ คงไว้)
export function requiresRca(severity?: string | null) {
  return ['D', 'E', 'F', 'G', 'H', 'I'].includes(String(severity ?? '').trim().toUpperCase())
}

// ── L×S (ใช้กับทะเบียนความเสี่ยงเท่านั้น) ────────────────────────────────────
export type RiskLevel = 'low' | 'medium' | 'high'

// ต้องตรงกับ generated column ใน scripts/risk-module-v2.sql — ถ้าแก้ที่นี่ต้องแก้ที่นั่นด้วย
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

export const LEVEL_LABEL: Record<RiskLevel, string> = { low: 'ต่ำ', medium: 'กลาง', high: 'สูง' }
export const LEVEL_TONE: Record<RiskLevel, BadgeColor> = { low: 'green', medium: 'amber', high: 'red' }

// คำอธิบายกำกับปุ่ม 1–5 เพื่อให้ผู้ประเมินต่างคนให้คะแนนสอดคล้องกัน
export const LIKELIHOOD_SCALE = [
  { value: 1, label: 'แทบไม่เกิด', hint: 'ไม่เคยเกิด หรือเกิดน้อยกว่าปีละครั้ง' },
  { value: 2, label: 'เกิดน้อย', hint: 'ปีละ 1–2 ครั้ง' },
  { value: 3, label: 'เกิดบ้าง', hint: 'เดือนละครั้ง' },
  { value: 4, label: 'เกิดบ่อย', hint: 'สัปดาห์ละครั้ง' },
  { value: 5, label: 'เกิดเกือบทุกครั้ง', hint: 'เกือบทุกวันหรือทุกรอบงาน' },
] as const

export const IMPACT_SCALE = [
  { value: 1, label: 'เล็กน้อยมาก', hint: 'ไม่กระทบผลตรวจหรือผู้ป่วย' },
  { value: 2, label: 'เล็กน้อย', hint: 'แก้ไขได้ในงาน ไม่กระทบผู้ป่วย' },
  { value: 3, label: 'ปานกลาง', hint: 'ต้องตรวจซ้ำ รายงานล่าช้า' },
  { value: 4, label: 'รุนแรง', hint: 'ผลผิดพลาดถึงผู้ป่วย หรือหยุดให้บริการบางส่วน' },
  { value: 5, label: 'รุนแรงมาก', hint: 'เป็นอันตรายต่อผู้ป่วยหรือเจ้าหน้าที่ หยุดให้บริการ' },
] as const

// ── สถานะ IOR ────────────────────────────────────────────────────────────────
export const INCIDENT_STATUSES = [
  { value: 'reported',   label: 'รอทบทวน',    icon: 'inbox',       tone: 'gray'   },
  { value: 'reviewing',  label: 'กำลังทบทวน', icon: 'eye',         tone: 'blue'   },
  { value: 'action',     label: 'กำลังแก้ไข', icon: 'edit',        tone: 'amber'  },
  { value: 'monitoring', label: 'ติดตามผล',   icon: 'clock',       tone: 'purple' },
  { value: 'closed',     label: 'ปิดแล้ว',    icon: 'shieldCheck', tone: 'green'  },
] as const satisfies readonly StatusMeta[]

// ── สถานะทะเบียนความเสี่ยง ───────────────────────────────────────────────────
export const REGISTER_STATUSES = [
  { value: 'open',       label: 'ยังไม่จัดการ',  icon: 'inbox',       tone: 'gray'   },
  { value: 'treating',   label: 'กำลังจัดการ',   icon: 'edit',        tone: 'amber'  },
  { value: 'monitoring', label: 'ติดตามผล',      icon: 'clock',       tone: 'purple' },
  { value: 'accepted',   label: 'ยอมรับความเสี่ยง', icon: 'check',    tone: 'blue'   },
  { value: 'closed',     label: 'ปิดแล้ว',       icon: 'shieldCheck', tone: 'green'  },
] as const satisfies readonly StatusMeta[]

export type StatusMeta = { value: string; label: string; icon: string; tone: BadgeColor }
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]['value']
export type RegisterStatus = (typeof REGISTER_STATUSES)[number]['value']

const UNKNOWN_STATUS: StatusMeta = { value: '', label: 'ไม่ระบุ', icon: 'alert', tone: 'gray' }

export function statusMeta(statuses: readonly StatusMeta[], value?: string | null): StatusMeta {
  return statuses.find(s => s.value === value) ?? UNKNOWN_STATUS
}

// ── ประเภทมาตรการแก้ไข ───────────────────────────────────────────────────────
export const ACTION_TYPES = [
  { value: 'correction', label: 'แก้ไขเฉพาะหน้า (Correction)' },
  { value: 'corrective', label: 'แก้ไขที่ต้นเหตุ (Corrective)' },
  { value: 'preventive', label: 'ป้องกันล่วงหน้า (Preventive)' },
  { value: 'follow_up',  label: 'ติดตามผล (Follow-up)' },
] as const

export const ACTION_STATUSES = [
  { value: 'open',        label: 'ยังไม่เริ่ม', tone: 'gray'  },
  { value: 'in_progress', label: 'กำลังทำ',     tone: 'amber' },
  { value: 'done',        label: 'เสร็จแล้ว',   tone: 'green' },
] as const

// ── การวิเคราะห์รากของปัญหา ──────────────────────────────────────────────────
export const RCA_METHODS = [
  { value: '5why',     label: '5 Why (ถามทำไม 5 ครั้ง)' },
  { value: 'fishbone', label: 'Fishbone / Ishikawa' },
  { value: 'fmea',     label: 'FMEA' },
  { value: 'other',    label: 'อื่นๆ' },
] as const

export const RCA_FACTORS = [
  { key: 'people',      label: 'คน' },
  { key: 'equipment',   label: 'เครื่องมือ' },
  { key: 'method',      label: 'วิธีปฏิบัติ' },
  { key: 'material',    label: 'วัสดุ/น้ำยา' },
  { key: 'environment', label: 'สิ่งแวดล้อม' },
  { key: 'management',  label: 'ระบบบริหาร' },
] as const

// ── รายการอ้างอิงที่ใช้ร่วมกัน ───────────────────────────────────────────────
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
] as const

export const REPORTER_POSITIONS = [
  'นักเทคนิคการแพทย์',
  'เจ้าพนักงานวิทยาศาสตร์ทางการแพทย์',
  'พนักงานประจำห้องทดลอง',
] as const

export const INCIDENT_CATEGORIES = [
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
] as const

export const THAI_MONTHS = [
  { value: '01', label: 'ม.ค.' }, { value: '02', label: 'ก.พ.' }, { value: '03', label: 'มี.ค.' },
  { value: '04', label: 'เม.ย.' }, { value: '05', label: 'พ.ค.' }, { value: '06', label: 'มิ.ย.' },
  { value: '07', label: 'ก.ค.' }, { value: '08', label: 'ส.ค.' }, { value: '09', label: 'ก.ย.' },
  { value: '10', label: 'ต.ค.' }, { value: '11', label: 'พ.ย.' }, { value: '12', label: 'ธ.ค.' },
] as const

// ── สไตล์ที่ใช้ซ้ำ ───────────────────────────────────────────────────────────
export const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: FONT.md,
  fontFamily: 'inherit',
  color: 'var(--ink)',
  background: 'var(--card)',
  outline: 'none',
  boxSizing: 'border-box',
}

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 88,
  lineHeight: 1.5,
  resize: 'vertical',
}

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: FONT.sm,
  fontWeight: 600,
  color: 'var(--muted)',
  marginBottom: 4,
}

// ตัวเลขในตาราง/KPI ต้องกว้างเท่ากันทุกหลัก ไม่งั้นตัวเลขเต้นเวลาอัปเดต
export const tabularNums: CSSProperties = { fontVariantNumeric: 'tabular-nums' }

// ── วันที่ ───────────────────────────────────────────────────────────────────
export function todayIso() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

export function parseDateOnly(value?: string | null) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatThaiDate(value?: string | null) {
  const date = parseDateOnly(value)
  if (!date) return '—'
  return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** จำนวนวันที่เลยกำหนดมาแล้ว — 0 หรือติดลบแปลว่ายังไม่เกิน */
export function daysOverdue(dueDate?: string | null) {
  const due = parseDateOnly(dueDate)
  if (!due) return 0
  due.setHours(23, 59, 59, 999)
  const diff = Date.now() - due.getTime()
  return diff <= 0 ? 0 : Math.floor(diff / 86_400_000)
}

/** ปีงบประมาณไทย: เริ่ม 1 ต.ค. ของปีก่อนหน้า */
export function fiscalYearOf(value?: string | null) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})/)
  if (!match) return ''
  const year = Number(match[1])
  return String(Number(match[2]) >= 10 ? year + 544 : year + 543)
}

export function currentFiscalYear() {
  const now = new Date()
  const thaiYear = now.getFullYear() + 543
  return now.getMonth() + 1 >= 10 ? thaiYear + 1 : thaiYear
}

export function fiscalYearOptions(selected?: string) {
  const current = currentFiscalYear()
  const years = [current, current - 1, current - 2, current - 3]
  if (selected && Number(selected)) years.push(Number(selected))
  return Array.from(new Set(years)).sort((a, b) => b - a)
}
