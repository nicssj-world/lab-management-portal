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

// Actions that represent actual DB mutations (add/edit/delete)
const CRUD_ACTIONS = [
  'test.create', 'test.update', 'test.delete', 'test.bulk_delete',
  'test.import', 'test.duplicate', 'test.purge_deleted',
  'upload', 'edit', 'delete',
]

export async function getAuditLog(supabase: SupabaseClient, limit = 100): Promise<AuditLogWithUser[]> {
  // Fetch extra rows to account for Admin entries that will be filtered out in memory
  const { data: logs, error } = await supabase
    .from('audit_log')
    .select('*')
    .in('action', CRUD_ACTIONS)
    .order('created_at', { ascending: false })
    .limit(limit * 4)
  if (error) throw error
  if (!logs?.length) return []

  const userIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))]
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, name, role')
    .in('id', userIds)

  const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]))

  return logs
    .slice(0, limit)
    .map((log) => ({
      ...log,
      user_name: profileMap.get(log.user_id)?.name ?? null,
    }))
}

export async function writeAuditLog(
  supabase: SupabaseClient,
  entry: { action: string; user_id?: string; target?: string; detail?: string }
): Promise<void> {
  await supabase.from('audit_log').insert(entry)
}
