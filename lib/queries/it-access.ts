import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ItSystem,
  ItAccessRecordWithProfile,
  ItAccessReview,
  ItDowntimeLogWithSystem,
  ItBackupAttachment,
  ItBackupLogWithRefs,
  ItVisitorLogWithRefs,
} from '@/lib/supabase/types'
import { runVisitorAutoCheckout } from '@/lib/it-visitor/auto-checkout-server'

const RECORD_SELECT =
  '*, profile:profiles!it_access_records_profile_id_fkey(id, name, position_title, ephis_id, status, deleted_at)'

// ระบุคอลัมน์แทน `*` เพื่อไม่ส่ง checkout_secret_hash ซึ่งเป็น credential verifier ไปยัง client
export const IT_VISITOR_LOG_SELECT = [
  'id', 'visit_type', 'visit_date', 'visitor_name', 'group_name', 'member_names',
  'party_size', 'phone', 'email', 'org_type', 'org_name', 'contact_dept',
  'entered_at', 'exited_at', 'activity_type', 'activity_other', 'appointment',
  'badge_exchanged', 'safety_ack', 'safety_ack_other', 'submission_key', 'created_at', 'closed_by',
  'closed_at', 'checkout_method', 'checkout_note',
  'closer:profiles!it_visitor_logs_closed_by_fkey(id, name)',
].join(', ')

// Allows the staff list to keep working while an existing deployment is being migrated.
export const IT_VISITOR_LOG_SELECT_LEGACY = [
  'id', 'visit_type', 'visit_date', 'visitor_name', 'group_name', 'member_names',
  'party_size', 'phone', 'email', 'org_type', 'org_name', 'contact_dept',
  'entered_at', 'exited_at', 'activity_type', 'activity_other', 'appointment',
  'badge_exchanged', 'safety_ack', 'submission_key', 'created_at', 'closed_by',
  'closed_at', 'checkout_method',
  'closer:profiles!it_visitor_logs_closed_by_fkey(id, name)',
].join(', ')

export function isMissingVisitorOptionalColumn(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === '42703' || /safety_ack_other/i.test(error.message ?? '')))
}

// Whole register, ordered like the paper form (manual display_order first, then name).
export async function getItAccessRecords(supabase: SupabaseClient): Promise<ItAccessRecordWithProfile[]> {
  const { data } = await supabase
    .from('it_access_records')
    .select(RECORD_SELECT)
    .order('display_order', { ascending: true, nullsFirst: false })
  const rows = (data ?? []) as ItAccessRecordWithProfile[]
  return rows.sort((a, b) => {
    const ao = a.display_order ?? Number.MAX_SAFE_INTEGER
    const bo = b.display_order ?? Number.MAX_SAFE_INTEGER
    if (ao !== bo) return ao - bo
    return (a.profile?.name ?? '').localeCompare(b.profile?.name ?? '', 'th')
  })
}

export async function getItSystems(supabase: SupabaseClient): Promise<ItSystem[]> {
  const { data } = await supabase
    .from('it_systems')
    .select('*')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })
  return (data ?? []) as ItSystem[]
}

export async function getLatestItAccessReview(supabase: SupabaseClient): Promise<ItAccessReview | null> {
  const { data } = await supabase
    .from('it_access_reviews')
    .select('*')
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as ItAccessReview) ?? null
}

export async function getItDowntimeLogs(supabase: SupabaseClient): Promise<ItDowntimeLogWithSystem[]> {
  const { data } = await supabase
    .from('it_downtime_logs')
    .select('*, system:it_systems(id, name)')
    .order('started_at', { ascending: false })
  return (data ?? []) as ItDowntimeLogWithSystem[]
}

export async function getItBackupLogs(supabase: SupabaseClient): Promise<ItBackupLogWithRefs[]> {
  const { data } = await supabase
    .from('it_backup_logs')
    .select('*, system:it_systems(id, name), performer:profiles!it_backup_logs_performed_by_fkey(id, name)')
    .order('log_date', { ascending: false })
  const logs = (data ?? []) as Omit<ItBackupLogWithRefs, 'attachments'>[]
  if (logs.length === 0) return []

  // Keep the list endpoint usable while an existing deployment is waiting for
  // the attachment migration to be applied.
  const { data: attachmentData } = await supabase
    .from('it_backup_attachments')
    .select('id, backup_log_id, file_name, content_type, size_bytes, uploaded_by, uploaded_at')
    .in('backup_log_id', logs.map((log) => log.id))
    .order('uploaded_at', { ascending: true })
  const attachments = (attachmentData ?? []) as ItBackupAttachment[]
  const byLog = new Map<string, ItBackupAttachment[]>()
  for (const attachment of attachments) {
    const list = byLog.get(attachment.backup_log_id) ?? []
    list.push(attachment)
    byLog.set(attachment.backup_log_id, list)
  }

  return logs.map((log) => ({ ...log, attachments: byLog.get(log.id) ?? [] }))
}

// บันทึกการเข้า-ออก — จำกัดจำนวนแถวเพราะทะเบียนนี้โตเร็วกว่าตารางอื่นในโมดูล
export async function getItVisitorLogs(
  supabase: SupabaseClient,
  options: { limit?: number } = {},
): Promise<ItVisitorLogWithRefs[]> {
  await runVisitorAutoCheckout()
  const primary = await supabase
    .from('it_visitor_logs')
    .select(IT_VISITOR_LOG_SELECT)
    .order('entered_at', { ascending: false })
    .limit(options.limit ?? 1000)
  if (!primary.error) return (primary.data ?? []) as unknown as ItVisitorLogWithRefs[]

  if (!isMissingVisitorOptionalColumn(primary.error)) return []
  const legacy = await supabase
    .from('it_visitor_logs')
    .select(IT_VISITOR_LOG_SELECT_LEGACY)
    .order('entered_at', { ascending: false })
    .limit(options.limit ?? 1000)
  return (legacy.data ?? []).map((row) => ({
    ...(row as unknown as Record<string, unknown>),
    safety_ack_other: null,
    checkout_note: null,
  })) as unknown as ItVisitorLogWithRefs[]
}
