import type { SupabaseClient } from '@supabase/supabase-js'
import type { Document } from '@/lib/supabase/types'

export interface DocumentFilters {
  cat?: string
  publicOnly?: boolean
  search?: string
}

export async function getDocuments(
  supabase: SupabaseClient,
  filters: DocumentFilters = {}
): Promise<Document[]> {
  let query = supabase.from('documents').select('*').order('date', { ascending: false })

  if (filters.cat) query = query.eq('cat', filters.cat)
  if (filters.publicOnly) query = query.eq('public', true)
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function upsertDocument(supabase: SupabaseClient, doc: Partial<Document>): Promise<Document> {
  const { data, error } = await supabase
    .from('documents')
    .upsert(doc)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDocument(supabase: SupabaseClient, id: number): Promise<void> {
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
}

export async function getDocumentDownloadUrl(supabase: SupabaseClient, storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}
