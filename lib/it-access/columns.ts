import type { ItAccessRecord } from '@/lib/supabase/types'

// The access-level checkbox columns, in the exact order of the paper form Fm-QP-LAB-24/01.
// The form's first column combines ลงทะเบียน + รับตัวอย่าง into a single permission level
// (a normal user checks 5 columns, an admin checks all 7).
// `label` is the full form wording (PDF + modal); `short` is the compact on-screen header.
// `group` splits operational duties from admin/system settings for visual grouping.
export const PERMISSION_COLUMNS: { key: keyof ItAccessRecord; label: string; short: string; group: 'op' | 'admin' }[] = [
  { key: 'can_register',      label: 'ลงทะเบียน / รับตัวอย่าง', short: 'ลงทะเบียน /\nรับตัวอย่าง', group: 'op' },
  { key: 'can_view_result',   label: 'ดูรายงานผล',             short: 'ดูรายงานผล',              group: 'op' },
  { key: 'can_report_result', label: 'รายงานผล',               short: 'รายงานผล',                group: 'op' },
  { key: 'can_verify_result', label: 'ตรวจสอบผล',              short: 'ตรวจสอบผล',               group: 'op' },
  { key: 'can_edit_result',   label: 'แก้ไขผล',                short: 'แก้ไขผล',                 group: 'op' },
  { key: 'can_set_parameter', label: 'Setting parameter',      short: 'Setting\nparameter',      group: 'admin' },
  { key: 'can_admin_setting', label: 'Admin setting',          short: 'Admin\nsetting',          group: 'admin' },
]
