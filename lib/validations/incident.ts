import { z } from 'zod'

// Schema เป็น object ธรรมดา ไม่ใช่ z.record — zod จะตัด key ที่ไม่รู้จักทิ้งให้เอง
// จึงส่งคอลัมน์ที่ไม่มีในตารางเข้า DB ไม่ได้แม้ client จะเผลอส่งทั้ง state มา

const optionalText = z.string().trim().max(4000).nullish()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD')

export const INCIDENT_STATUS_VALUES = ['reported', 'reviewing', 'action', 'monitoring', 'closed'] as const

export const incidentSchema = z.object({
  report_no: optionalText,
  event_date: isoDate,
  event_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullish(),
  reporter_name: optionalText,
  reporter_position: optionalText,
  department_found: optionalText,
  department_target: optionalText,
  event_category: optionalText,
  event_detail: z.string().trim().min(1, 'ต้องกรอกรายละเอียดเหตุการณ์').max(4000),
  immediate_correction: optionalText,
  impact_summary: optionalText,
  evidence_note: optionalText,

  // ── ฟิลด์ที่ต้องมีสิทธิ์ทบทวน (ดู REVIEW_ONLY_FIELDS ใน lib/risk/access.ts) ──
  severity_level: z.string().regex(/^[A-I]$/, 'ระดับความรุนแรงต้องเป็น A ถึง I').nullish(),
  requires_rca: z.boolean().optional(),
  status: z.enum(INCIDENT_STATUS_VALUES).optional(),
  review_note: optionalText,
  rca_method: optionalText,
  root_cause: optionalText,
  rca_factors: z.record(z.string(), z.boolean()).optional(),
  effectiveness_result: optionalText,
})

export const incidentPatchSchema = incidentSchema.partial()

/** ฟอร์มสำหรับเจ้าหน้าที่ทั่วไป — ไม่รับ severity/status/RCA ผู้ทบทวนเป็นคนใส่ทีหลัง */
export const incidentReportSchema = z.object({
  event_date: isoDate,
  event_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullish(),
  department_found: z.string().trim().min(1, 'ต้องเลือกหน่วยงานที่พบเหตุการณ์'),
  department_target: optionalText,
  event_category: z.string().trim().min(1, 'ต้องเลือกประเภทเหตุการณ์'),
  event_detail: z.string().trim().min(1, 'ต้องกรอกรายละเอียดเหตุการณ์').max(4000),
  immediate_correction: optionalText,
  reporter_position: optionalText,
  // ชื่อผู้ที่พบเหตุการณ์ ใช้เมื่อบันทึกแทนคนที่แจ้งทางโทรศัพท์หรือใบกระดาษ
  // route จะยอมรับเฉพาะผู้มีสิทธิ์ edit ที่เหลือจะถูกทับด้วยชื่อจาก session
  reporter_name: optionalText,
})

export const incidentReviewSchema = z.object({
  severity_level: z.string().regex(/^[A-I]$/, 'ต้องเลือกระดับความรุนแรง A ถึง I'),
  requires_rca: z.boolean(),
  review_note: optionalText,
})

export const incidentActionSchema = z.object({
  action_type: z.enum(['correction', 'corrective', 'preventive', 'follow_up']),
  description: z.string().trim().min(1, 'ต้องกรอกรายละเอียดมาตรการ').max(2000),
  owner: optionalText,
  due_date: isoDate.nullish(),
  status: z.enum(['open', 'in_progress', 'done']).optional(),
  evidence: optionalText,
  // ── ติดตามประสิทธิผล — คอลัมน์มีอยู่แล้วแต่เดิมไม่มีที่กรอก ──
  result: optionalText,
  is_effective: z.boolean().nullish(),
  followed_by: optionalText,
  follow_up_date: isoDate.nullish(),
  next_follow_up_date: isoDate.nullish(),
})

export const incidentActionPatchSchema = incidentActionSchema.partial().extend({
  id: z.number().int().positive(),
})

export type IncidentInput = z.infer<typeof incidentSchema>
export type IncidentActionInput = z.infer<typeof incidentActionSchema>
