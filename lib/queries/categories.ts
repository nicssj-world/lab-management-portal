import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category } from '@/lib/supabase/types'

export async function getCategories(supabase: SupabaseClient): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function getCategoryById(supabase: SupabaseClient, id: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function upsertCategory(supabase: SupabaseClient, category: Partial<Category> & { id: string }): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .upsert(category)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategory(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

export async function reorderCategories(supabase: SupabaseClient, ids: string[]): Promise<void> {
  const updates = ids.map((id, idx) => ({ id, sort_order: idx }))
  const { error } = await supabase.from('categories').upsert(updates)
  if (error) throw error
}
