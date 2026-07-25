// กฎ semantic ของฟอร์มบันทึกการเข้า-ออก
//
// โมดูลนี้ "บริสุทธิ์" — import แค่ types กับ constants ไม่แตะ Supabase/next/crypto
// จึงรันได้ทั้งในเบราว์เซอร์และใน API route ด้วยโค้ดชุดเดียวกัน
// กฎฝั่ง client กับ server จึงไม่มีทางหลุดจากกัน (แบบเดียวกับ lib/surveys/validation.ts)

import {
  ACTIVITY_TYPES, APPOINTMENTS, BADGE_STATES, MAX_PARTY_SIZE,
  ORG_TYPES, SAFETY_ACKS, VISIT_TYPES,
} from './constants'
import type {
  NormalizedVisitorLog, VisitorSubmissionInput,
  VisitorValidationIssue, VisitorValidationResult,
} from './types'

/** เวลาเข้าล่วงหน้าได้ไม่เกิน 1 ชม. — กันกรอกวันที่อนาคตผิด แต่เผื่อนาฬิกาเครื่องเพี้ยน */
const MAX_FUTURE_MS = 60 * 60 * 1000
/** ย้อนหลังได้ไม่เกิน 30 วัน — กันพิมพ์ปีผิด */
const MAX_PAST_MS = 30 * 24 * 60 * 60 * 1000

const clean = (v: string | null | undefined) => (v ?? '').trim()

export function validateVisitorSubmission(
  input: VisitorSubmissionInput,
  now = Date.now(),
): VisitorValidationResult {
  const issues: VisitorValidationIssue[] = []
  const add = (field: VisitorValidationIssue['field'], message: string) => issues.push({ field, message })

  // ── enum ──
  if (!VISIT_TYPES.includes(input.visit_type)) add('visit_type', 'กรุณาเลือกประเภทฟอร์ม')
  if (!ORG_TYPES.includes(input.org_type)) add('org_type', 'กรุณาเลือกประเภทหน่วยงาน')
  if (!ACTIVITY_TYPES.includes(input.activity_type)) add('activity_type', 'กรุณาเลือกประเภทกิจกรรม')
  if (!APPOINTMENTS.includes(input.appointment)) add('appointment', 'กรุณาระบุว่านัดหมายล่วงหน้าหรือไม่')
  if (!BADGE_STATES.includes(input.badge_exchanged)) add('badge_exchanged', 'กรุณาระบุว่าแลกบัตรหรือไม่')
  if (!SAFETY_ACKS.includes(input.safety_ack)) add('safety_ack', 'กรุณาตอบข้อนโยบายความปลอดภัย')

  // ── ข้อความบังคับ ──
  const visitorName = clean(input.visitor_name)
  if (!visitorName) {
    add('visitor_name', input.visit_type === 'group' ? 'กรุณากรอกชื่อหัวหน้าคณะ/ผู้ประสานงาน' : 'กรุณากรอกชื่อ-สกุล')
  } else if (visitorName.length > 200) {
    add('visitor_name', 'ชื่อยาวเกิน 200 ตัวอักษร')
  }

  const phone = clean(input.phone)
  if (!phone) add('phone', 'กรุณากรอกเบอร์โทรศัพท์')
  else if (!/^[0-9+\-\s()]{6,30}$/.test(phone)) add('phone', 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง')

  const email = clean(input.email)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) add('email', 'รูปแบบอีเมลไม่ถูกต้อง')
  if (email.length > 200) add('email', 'อีเมลยาวเกิน 200 ตัวอักษร')

  const orgName = clean(input.org_name)
  if (!orgName) add('org_name', 'กรุณากรอกชื่อหน่วยงาน/บริษัท')
  else if (orgName.length > 200) add('org_name', 'ชื่อหน่วยงานยาวเกิน 200 ตัวอักษร')

  // dropdown ส่ง DEPARTMENTS มาตรง ๆ ส่วน "อื่นๆ" ให้ส่งข้อความที่ผู้ใช้ระบุมาแทน
  const contactDept = clean(input.contact_dept)
  if (!contactDept) add('contact_dept', 'กรุณาเลือกหน่วยงานที่ต้องการติดต่อ')
  else if (contactDept.length > 200) add('contact_dept', 'ชื่อหน่วยงานยาวเกิน 200 ตัวอักษร')

  // ── ช่องที่ขึ้นกับตัวเลือกอื่น ──
  const activityOther = clean(input.activity_other)
  if (input.activity_type === 'other' && !activityOther) {
    add('activity_other', 'กรุณาระบุประเภทกิจกรรม')
  }
  if (activityOther.length > 300) add('activity_other', 'ข้อความยาวเกิน 300 ตัวอักษร')

  const groupName = clean(input.group_name)
  const memberNames = clean(input.member_names)
  if (input.visit_type === 'group') {
    if (!groupName) add('group_name', 'กรุณากรอกชื่อคณะ/กลุ่ม')
    else if (groupName.length > 200) add('group_name', 'ชื่อคณะยาวเกิน 200 ตัวอักษร')
    if (memberNames.length > 5000) add('member_names', 'รายชื่อยาวเกิน 5,000 ตัวอักษร')
  }

  // ── จำนวนคน — ความหมายต่างกันตามประเภทฟอร์ม ──
  // รายบุคคลกรอก "ผู้ติดตาม" (0 = มาคนเดียว) · หมู่คณะกรอก "ทั้งหมด" (รวมผู้กรอกแล้ว)
  const headCount = Number(input.head_count)
  const minHeadCount = input.visit_type === 'group' ? 1 : 0
  let partySize = 1
  if (!Number.isInteger(headCount) || headCount < minHeadCount) {
    add('head_count', input.visit_type === 'group'
      ? 'กรุณากรอกจำนวนผู้มาทั้งหมด (อย่างน้อย 1 คน)'
      : 'กรุณากรอกจำนวนผู้ติดตาม (0 หากมาคนเดียว)')
  } else {
    partySize = input.visit_type === 'group' ? headCount : headCount + 1
    if (partySize > MAX_PARTY_SIZE) {
      add('head_count', `จำนวนคนต้องไม่เกิน ${MAX_PARTY_SIZE} คน`)
    }
  }

  // ── วันที่/เวลา ──
  const visitDate = clean(input.visit_date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) add('visit_date', 'กรุณาระบุวันที่')

  const enteredMs = Date.parse(input.entered_at ?? '')
  if (!Number.isFinite(enteredMs)) {
    add('entered_at', 'กรุณาระบุเวลาเข้า')
  } else if (enteredMs - now > MAX_FUTURE_MS) {
    add('entered_at', 'เวลาเข้าต้องไม่เป็นเวลาในอนาคต')
  } else if (now - enteredMs > MAX_PAST_MS) {
    add('entered_at', 'เวลาเข้าย้อนหลังได้ไม่เกิน 30 วัน')
  }

  if (issues.length > 0) return { ok: false, issues }

  const row: NormalizedVisitorLog = {
    visit_type: input.visit_type,
    visit_date: visitDate,
    visitor_name: visitorName,
    group_name: input.visit_type === 'group' ? groupName : null,
    member_names: input.visit_type === 'group' ? (memberNames || null) : null,
    party_size: partySize,
    phone,
    email: email || null,
    org_type: input.org_type,
    org_name: orgName,
    contact_dept: contactDept,
    entered_at: new Date(enteredMs).toISOString(),
    activity_type: input.activity_type,
    activity_other: input.activity_type === 'other' ? activityOther : null,
    appointment: input.appointment,
    badge_exchanged: input.badge_exchanged,
    safety_ack: input.safety_ack,
  }
  return { ok: true, row }
}
