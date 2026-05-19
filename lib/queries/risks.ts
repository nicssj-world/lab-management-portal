import type { SupabaseClient } from '@supabase/supabase-js'
import type { Risk } from '@/lib/supabase/types'

export async function getRisks(supabase: SupabaseClient): Promise<Risk[]> {
  const { data, error } = await supabase
    .from('risks')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertRisk(supabase: SupabaseClient, risk: Partial<Risk>): Promise<Risk> {
  const { data, error } = await supabase
    .from('risks')
    .upsert(risk)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteRisk(supabase: SupabaseClient, id: number): Promise<void> {
  const { error } = await supabase.from('risks').delete().eq('id', id)
  if (error) throw error
}
