import { z } from 'zod'

// Empty/whitespace text inputs → null (so a blanked field clears under .partial())
const optStr = z.preprocess(
  (v) => (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v),
  z.string().optional().nullable(),
)

const PERMISSION_FLAGS = {
  can_register:      z.boolean().default(false),
  can_view_result:   z.boolean().default(false),
  can_report_result: z.boolean().default(false),
  can_verify_result: z.boolean().default(false),
  can_edit_result:   z.boolean().default(false),
  can_set_parameter: z.boolean().default(false),
  can_admin_setting: z.boolean().default(false),
}

// ── Access-rights register (POST /api/admin/it-access) ──
export const ItAccessRecordSchema = z.object({
  profile_id:    z.string().uuid('กรุณาเลือกบุคลากร'),
  lis_user_id:   optStr,
  ...PERMISSION_FLAGS,
  system_ids:    z.array(z.string().uuid()).default([]),
  display_order: z.number().int().optional().nullable(),
})
export type ItAccessRecordInput = z.infer<typeof ItAccessRecordSchema>

// PATCH cannot move a row to a different person — only rights/LIS/systems/order change.
export const ItAccessRecordUpdateSchema = z.object({
  lis_user_id:   optStr,
  ...PERMISSION_FLAGS,
  system_ids:    z.array(z.string().uuid()).optional(),
  display_order: z.number().int().optional().nullable(),
}).partial()
export type ItAccessRecordUpdateInput = z.infer<typeof ItAccessRecordUpdateSchema>

// ── Systems management ──
export const ItSystemSchema = z.object({
  name:      z.string().trim().min(1, 'กรุณากรอกชื่อระบบ').max(100),
  is_active: z.boolean().optional(),
})
export const ItSystemUpdateSchema = ItSystemSchema.partial()

// ── Annual review ──
export const ItAccessReviewSchema = z.object({
  note: optStr,
})

// ── Downtime log ──
export const ItDowntimeSchema = z.object({
  system_id:        z.string().uuid('กรุณาเลือกระบบ'),
  started_at:       z.string().min(1, 'กรุณาระบุเวลาที่เริ่มเกิดเหตุ'),
  ended_at:         optStr,
  cause:            optStr,
  resolution:       optStr,
  used_contingency: z.boolean().default(false),
})
export const ItDowntimeUpdateSchema = ItDowntimeSchema.partial()

// ── Backup log ──
export const ItBackupSchema = z.object({
  system_id:    z.string().uuid('กรุณาเลือกระบบ'),
  log_date:     z.string().min(1, 'กรุณาระบุวันที่'),
  activity:     z.enum(['backup', 'restore_test']).default('backup'),
  result:       z.enum(['success', 'failed']).default('success'),
  performed_by: z.string().uuid().optional().nullable(),
  note:         optStr,
})
export const ItBackupUpdateSchema = ItBackupSchema.partial()
