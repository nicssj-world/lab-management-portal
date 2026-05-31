import type { SupabaseClient } from '@supabase/supabase-js'
import type { ManualSection } from '@/lib/supabase/types'

export async function getAllManualSections(supabase: SupabaseClient): Promise<ManualSection[]> {
  const { data } = await supabase
    .from('manual_sections')
    .select('id, body_html_th, body_html_en, updated_at, updated_by')
    .order('id')
  return (data ?? []) as ManualSection[]
}

export async function getManualSection(supabase: SupabaseClient, id: string): Promise<ManualSection | null> {
  const { data } = await supabase
    .from('manual_sections')
    .select('id, body_html_th, body_html_en, updated_at, updated_by')
    .eq('id', id)
    .single()
  return data as ManualSection | null
}
