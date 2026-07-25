import { z } from 'zod'
import {
  ACTIVITY_TYPES, APPOINTMENTS, BADGE_STATES,
  ORG_TYPES, SAFETY_ACKS, VISIT_TYPES,
} from '@/lib/it-visitor/constants'

// Empty/whitespace text inputs → null (so a blanked field clears under .partial())
const optStr = z.preprocess(
  (v) => (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v),
  z.string().optional().nullable(),
)

// ── Public submission (POST /api/it-visitors/[token]) ──
// รูปร่างเท่านั้น — กฎ semantic อยู่ที่ lib/it-visitor/validation.ts ซึ่ง client ใช้ร่วม
export const visitorSubmissionSchema = z.object({
  submissionKey: z.string().uuid(),
  challenge:     z.string().min(40).max(2_048),
  website:       z.string().max(200).optional().default(''),   // honeypot
  form: z.object({
    visit_type:      z.enum(VISIT_TYPES),
    visit_date:      z.string().min(1).max(20),
    visitor_name:    z.string().min(1).max(200),
    group_name:      optStr,
    member_names:    optStr,
    head_count:      z.number().int().min(0).max(500),
    phone:           z.string().min(1).max(30),
    email:           optStr,
    org_type:        z.enum(ORG_TYPES),
    org_name:        z.string().min(1).max(200),
    contact_dept:    z.string().min(1).max(200),
    entered_at:      z.string().min(1).max(40),
    activity_type:   z.enum(ACTIVITY_TYPES),
    activity_other:  optStr,
    appointment:     z.enum(APPOINTMENTS),
    badge_exchanged: z.enum(BADGE_STATES),
    safety_ack:      z.enum(SAFETY_ACKS),
  }),
})

// ── Staff edit (PATCH /api/admin/it-visitors/[id]) ──
// visit_type / submission_key แก้ไม่ได้ — เป็นตัวตนของบันทึก
export const ItVisitorUpdateSchema = z.object({
  visit_date:      z.string().min(1, 'กรุณาระบุวันที่').max(20),
  visitor_name:    z.string().trim().min(1, 'กรุณากรอกชื่อ').max(200),
  group_name:      optStr,
  member_names:    optStr,
  party_size:      z.number().int().min(1, 'จำนวนคนต้องอย่างน้อย 1').max(500),
  phone:           z.string().trim().min(1, 'กรุณากรอกเบอร์โทรศัพท์').max(30),
  email:           optStr,
  org_type:        z.enum(ORG_TYPES),
  org_name:        z.string().trim().min(1, 'กรุณากรอกชื่อหน่วยงาน').max(200),
  contact_dept:    z.string().trim().min(1, 'กรุณาเลือกหน่วยงานที่ติดต่อ').max(200),
  entered_at:      z.string().min(1, 'กรุณาระบุเวลาเข้า'),
  exited_at:       optStr,
  activity_type:   z.enum(ACTIVITY_TYPES),
  activity_other:  optStr,
  appointment:     z.enum(APPOINTMENTS),
  badge_exchanged: z.enum(BADGE_STATES),
  safety_ack:      z.enum(SAFETY_ACKS),
}).partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'ไม่มีข้อมูลที่ต้องแก้ไข' },
)

// ── Form settings (PATCH /api/admin/it-visitors/settings) ──
export const ItVisitorSettingsSchema = z.object({
  is_open:     z.boolean().optional(),
  rotateToken: z.literal(true).optional(),
}).refine(
  (v) => v.is_open !== undefined || v.rotateToken === true,
  { message: 'ไม่มีข้อมูลที่ต้องแก้ไข' },
)
