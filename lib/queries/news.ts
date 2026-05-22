import type { SupabaseClient } from '@supabase/supabase-js'
import type { News } from '@/lib/supabase/types'

export interface NewsFilters {
  cat?: string
  publishedOnly?: boolean
  isNew?: boolean
  search?: string
  limit?: number
}

export async function getNews(supabase: SupabaseClient, filters: NewsFilters = {}): Promise<News[]> {
  let query = supabase.from('news').select('*').order('created_at', { ascending: false })

  if (filters.publishedOnly) query = query.eq('published', true)
  if (filters.cat)    query = query.eq('cat', filters.cat)
  if (filters.isNew)  query = query.eq('is_new', true)
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,excerpt.ilike.%${filters.search}%`)
  }
  if (filters.limit) query = query.limit(filters.limit)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getNewsById(supabase: SupabaseClient, id: number): Promise<News | null> {
  const { data, error } = await supabase
    .from('news')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function upsertNews(supabase: SupabaseClient, news: Partial<News>): Promise<News> {
  const { data, error } = await supabase
    .from('news')
    .upsert({ ...news, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteNews(supabase: SupabaseClient, id: number): Promise<void> {
  const { error } = await supabase.from('news').delete().eq('id', id)
  if (error) throw error
}

export async function incrementNewsViews(supabase: SupabaseClient, id: number): Promise<void> {
  await supabase.rpc('increment_news_views', { news_id: id })
}

export async function getAdjacentNews(
  supabase: SupabaseClient,
  id: number
): Promise<{ prev: Pick<News, 'id' | 'title'> | null; next: Pick<News, 'id' | 'title'> | null }> {
  const { data: current } = await supabase.from('news').select('created_at').eq('id', id).single()
  if (!current) return { prev: null, next: null }

  const [prevRes, nextRes] = await Promise.all([
    supabase.from('news').select('id, title').eq('published', true)
      .lt('created_at', current.created_at).order('created_at', { ascending: false }).limit(1),
    supabase.from('news').select('id, title').eq('published', true)
      .gt('created_at', current.created_at).order('created_at', { ascending: true }).limit(1),
  ])
  return {
    prev: (prevRes.data?.[0] as Pick<News, 'id' | 'title'> | undefined) ?? null,
    next: (nextRes.data?.[0] as Pick<News, 'id' | 'title'> | undefined) ?? null,
  }
}
