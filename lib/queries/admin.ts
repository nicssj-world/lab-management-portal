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

export async function getAuditLog(supabase: SupabaseClient, limit = 100): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function writeAuditLog(
  supabase: SupabaseClient,
  entry: { action: string; user_id?: string; target?: string; detail?: string }
): Promise<void> {
  await supabase.from('audit_log').insert(entry)
}
