import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, AuditLog } from '@/lib/supabase/types'

export async function getProfiles(supabase: SupabaseClient): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function updateProfile(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<Profile, 'name' | 'role' | 'dept' | 'status'>>
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export type AuditLogWithUser = AuditLog & { user_name: string | null }

export async function getAuditLog(supabase: SupabaseClient, limit = 100): Promise<AuditLogWithUser[]> {
  // Fetch more rows than needed to account for Admin-filtered entries
  const { data: logs, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit * 3)
  if (error) throw error
  if (!logs?.length) return []

  // Resolve user names and roles via a separate query
  const userIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))]
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, name, role')
    .in('id', userIds)

  const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]))

  return logs
    .map((log) => ({
      ...log,
      user_name: profileMap.get(log.user_id)?.name ?? null,
      _role:     profileMap.get(log.user_id)?.role ?? null,
    }))
    .filter((log) => log._role !== 'Admin')
    .slice(0, limit)
    .map(({ _role, ...log }) => log)
}

export async function writeAuditLog(
  supabase: SupabaseClient,
  entry: { action: string; user_id?: string; target?: string; detail?: string }
): Promise<void> {
  await supabase.from('audit_log').insert(entry)
}
