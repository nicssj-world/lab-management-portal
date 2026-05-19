import type { SupabaseClient } from '@supabase/supabase-js'
import type { Test } from '@/lib/supabase/types'

export interface TestFilters {
  category?: string
  search?: string
  popular?: boolean
  active?: boolean
  page?: number
  pageSize?: number
}

export async function getTests(
  supabase: SupabaseClient,
  filters: TestFilters = {}
): Promise<{ data: Test[]; count: number }> {
  const { category, search, popular, active = true, page = 0, pageSize = 50 } = filters

  let query = supabase
    .from('tests')
    .select('*', { count: 'exact' })
    .eq('active', active)
    .order('code')
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (category) query = query.eq('category_id', category)
  if (popular !== undefined) query = query.eq('popular', popular)
  if (search) {
    query = query.or(`th.ilike.%${search}%,en.ilike.%${search}%,code.ilike.%${search}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

export async function getTestByCode(supabase: SupabaseClient, code: string): Promise<Test | null> {
  const { data, error } = await supabase
    .from('tests')
    .select('*, categories(*)')
    .eq('code', code)
    .single()
  if (error) return null
  return data
}

export async function upsertTest(supabase: SupabaseClient, test: Partial<Test>): Promise<Test> {
  const { data, error } = await supabase
    .from('tests')
    .upsert({ ...test, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTest(supabase: SupabaseClient, id: number): Promise<void> {
  const { error } = await supabase.from('tests').delete().eq('id', id)
  if (error) throw error
}

export async function getPopularTests(supabase: SupabaseClient, limit = 6): Promise<Test[]> {
  const { data, error } = await supabase
    .from('tests')
    .select('*')
    .eq('popular', true)
    .eq('active', true)
    .limit(limit)
  if (error) throw error
  return data ?? []
}
