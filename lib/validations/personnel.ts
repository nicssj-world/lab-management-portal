import { z } from 'zod'
import { DEPARTMENTS } from '@/lib/validations/user-schema'

// Empty strings from form inputs → undefined (so optional date/text fields clear cleanly)
const optStr = z.string().trim().optional().or(z.literal('').transform(() => undefined))
// Empty/whitespace date inputs → null (Postgres rejects '' for `date` columns; null clears cleanly)
const optDate = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().optional().nullable(),
)
const optNum = z.number().optional().nullable()
const optDigits = z.preprocess(
  (value) => typeof value === 'string' ? value.trim() : value,
  z.string()
    .regex(/^\d*$/, 'กรุณากรอกเฉพาะตัวเลข')
    .transform((value) => value || undefined)
    .optional(),
)

// ── Profile personnel fields (PATCH /api/admin/personnel/[id]) ──
export const PersonnelProfileSchema = z.object({
  ephis_id:          optDigits,
  position_title:    optStr,
  unit:              optStr,
  dept:              z.enum(DEPARTMENTS).optional().nullable(),
  employment_type:   optStr,
  start_date:        optDate,
  education:         optStr,
  mt_license_no:     optDigits,
  mt_license_expiry: optDate,
})
export type PersonnelProfileInput = z.infer<typeof PersonnelProfileSchema>

// ── Certifications (ISO 6.2.3) ──
export const CertificationSchema = z.object({
  cert_type:   optStr,
  cert_name:   z.string().min(1, 'กรุณากรอกชื่อใบรับรอง').max(200),
  cert_no:     optStr,
  issuer:      optStr,
  issue_date:  optDate,
  expiry_date: optDate,
  status:      z.enum(['active', 'expired', 'revoked']).default('active'),
  remark:      optStr,
  file_url:    optStr,
})
export type CertificationInput = z.infer<typeof CertificationSchema>

// ── Training records (ISO 6.2.4) ──
export const TrainingSchema = z.object({
  topic:         z.string().min(1, 'กรุณากรอกหัวข้อการอบรม').max(300),
  training_date: optDate,
  hours:         optNum,
  provider:      optStr,
  location:      optStr,
  training_type: z.enum(['internal', 'external', 'CME', 'CPD']).optional().nullable(),
  cpd_credits:   optNum,
  evidence_url:  optStr,
  notes:         optStr,
})
export type TrainingInput = z.infer<typeof TrainingSchema>

// ── Competency assessments (ISO 6.2.5) ──
export const CompetencySchema = z.object({
  assessment_type: z.enum(['initial', 'periodic']).default('initial'),
  area:            optStr,
  test_id:         z.number().int().positive().optional().nullable(),
  assessor_id:     z.string().uuid().optional().nullable(),
  assessment_date: optDate,
  next_due_date:   optDate,
  score_knowledge: optNum,
  score_safety:    optNum,
  score_practical: optNum,
  result:          z.enum(['pass', 'fail']).optional().nullable(),
  evidence_url:    optStr,
  notes:           optStr,
})
export type CompetencyInput = z.infer<typeof CompetencySchema>

// ── Authorizations / work assignment (ISO 6.2.6) ──
// Base object (used for PATCH .partial()); refined version (used for create) enforces test_id|category.
export const AuthorizationBaseSchema = z.object({
  test_id:         z.number().int().positive().optional().nullable(),
  category:        optStr,
  role_type:       z.enum(['performer', 'reporter', 'approver', 'authorized_signatory', 'deputy']).default('performer'),
  competency_id:   z.string().uuid().optional().nullable(),
  authorized_date: optDate,
  status:          z.enum(['active', 'revoked']).default('active'),
  revoked_date:    optDate,
  notes:           optStr,
})
export const AuthorizationSchema = AuthorizationBaseSchema.refine(
  (v) => v.test_id != null || (v.category && v.category.length > 0),
  { message: 'ต้องระบุ test หรือหมวดอย่างน้อยหนึ่งอย่าง', path: ['test_id'] },
)
export type AuthorizationInput = z.infer<typeof AuthorizationSchema>

// ── Org chart nodes (editable organization chart) ──
export const OrgNodeCreateSchema = z.object({
  parent_id:   z.string().uuid().optional().nullable(),
  title:       z.string().min(1, 'กรุณากรอกชื่อกล่อง').max(200),
  node_type:   z.enum(['leadership', 'position', 'unit']).default('unit'),
  is_linkable: z.boolean().default(true),
  sort_order:  z.number().int().optional(),
})
export const OrgNodeUpdateSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  person_name: optStr,
  phone:       optStr,
  profile_id:  z.string().uuid().optional().nullable(),
  photo_url:   optStr,
  parent_id:   z.string().uuid().optional().nullable(),
  sort_order:  z.number().int().optional(),
})
export type OrgNodeCreateInput = z.infer<typeof OrgNodeCreateSchema>

// ── Job Description / JS (ISO 6.2.2) ──
export const JdSchema = z.object({
  jd_code:        optStr,
  position_title: optStr,
  version:        z.string().min(1).default('1'),
  content:        optStr,
  file_url:       optStr,
  effective_date: optDate,
  approver_name:  optStr,
  approver_position: optStr,
  status:         z.enum(['Draft', 'Active', 'Obsolete']).default('Draft'),
  revision_note:  optStr,  // used when creating a revision on update
})
export type JdInput = z.infer<typeof JdSchema>

// ── Training plan (ISO 6.2.4) ──
export const TrainingPlanSchema = z.object({
  year:   z.number().int().min(2500).max(2700),
  topic:  z.string().min(1, 'กรุณากรอกหัวข้อ').max(300),
  source: optStr,
  status: z.enum(['planned', 'done', 'cancelled']).default('planned'),
  training_id: z.string().uuid().optional().nullable(),
  notes:  optStr,
})
export type TrainingPlanInput = z.infer<typeof TrainingPlanSchema>

// ── Orientation checklist (ISO 6.2.4) ──
export const OrientationSchema = z.object({
  items: z.array(z.object({ key: z.string(), label: z.string(), done: z.boolean() })),
  completed: z.boolean().optional(),
})
export type OrientationInput = z.infer<typeof OrientationSchema>

// Default orientation template for a new staff member
export const ORIENTATION_TEMPLATE: { key: string; label: string }[] = [
  { key: 'safety',     label: 'อบรมความปลอดภัยในห้องปฏิบัติการ (Lab Safety)' },
  { key: 'biosafety',  label: 'การจัดการความเสี่ยงชีวภาพ / สารเคมี' },
  { key: 'qms',        label: 'ระบบคุณภาพ ISO 15189 และเอกสารคุณภาพ' },
  { key: 'sop',        label: 'อ่านและเข้าใจ SOP ที่เกี่ยวข้อง' },
  { key: 'equipment',  label: 'การใช้งานเครื่องมือพื้นฐาน' },
  { key: 'lis',        label: 'การใช้งานระบบ LIS / สารสนเทศ' },
  { key: 'emergency',  label: 'แผนเผชิญเหตุฉุกเฉิน / อัคคีภัย' },
  { key: 'confiden',   label: 'ลงนามข้อตกลงรักษาความลับ (Confidentiality)' },
]
