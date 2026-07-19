import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ItSystem,
  ItAccessRecordWithProfile,
  ItAccessReview,
  ItDowntimeLogWithSystem,
  ItBackupLogWithRefs,
} from '@/lib/supabase/types'

const RECORD_SELECT =
  '*, profile:profiles!it_access_records_profile_id_fkey(id, name, position_title, ephis_id, status, deleted_at)'

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
  return (data ?? []) as ItBackupLogWithRefs[]
}
