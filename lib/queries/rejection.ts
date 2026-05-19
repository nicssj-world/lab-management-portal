import type { SupabaseClient } from '@supabase/supabase-js'
import type { RejectionLog } from '@/lib/supabase/types'

export interface RejectionFilters {
  severity?: string
  dept?: string
  search?: string
  limit?: number
}

export async function getRejectionLogs(
  supabase: SupabaseClient,
  filters: RejectionFilters = {}
): Promise<RejectionLog[]> {
  let query = supabase
    .from('rejection_log')
    .select('*')
    .order('logged_at', { ascending: false })

  if (filters.severity) query = query.eq('severity', filters.severity)
  if (filters.dept) query = query.eq('dept', filters.dept)
  if (filters.search) {
    query = query.or(`ref_no.ilike.%${filters.search}%,reason.ilike.%${filters.search}%,test_code.ilike.%${filters.search}%`)
  }
  if (filters.limit) query = query.limit(filters.limit)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function addRejectionLog(
  supabase: SupabaseClient,
  log: Omit<RejectionLog, 'id' | 'logged_at'>
): Promise<RejectionLog> {
  const { data, error } = await supabase
    .from('rejection_log')
    .insert(log)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getRejectionStats(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('rejection_log')
    .select('severity, reason')
  if (error) throw error

  const byReason: Record<string, number> = {}
  const bySeverity: Record<string, number> = {}
  for (const row of data ?? []) {
    byReason[row.reason ?? 'Unknown'] = (byReason[row.reason ?? 'Unknown'] ?? 0) + 1
    bySeverity[row.severity ?? 'low'] = (bySeverity[row.severity ?? 'low'] ?? 0) + 1
  }
  return { byReason, bySeverity, total: data?.length ?? 0 }
}
