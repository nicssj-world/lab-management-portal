import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Document } from '@/lib/supabase/types'
import { resolveDocumentSortColumn } from '@/lib/documents/sort'

export interface DocumentFilters {
  type?:       string
  visibility?: string
  search?:     string
  page?:       number
  pageSize?:   number
  sortBy?:     string
  sortDir?:    'asc' | 'desc'
}

export async function getDocuments(
  _supabase: SupabaseClient,
  filters: DocumentFilters = {}
): Promise<{ data: Document[]; count: number }> {
  const {
    type, visibility, search,
    page = 1, pageSize = 50,
    sortBy = 'updated_at', sortDir = 'desc',
  } = filters
  const sortColumn = resolveDocumentSortColumn(sortBy)

  let query = supabaseAdmin
    .from('documents')
    .select('*', { count: 'exact' })

  if (type && type !== 'All') query = query.eq('type', type)
  if (visibility)             query = query.eq('visibility', visibility)
  if (search) {
    query = query.or(`title.ilike.%${search}%,document_code.ilike.%${search}%`)
  }

  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  const { data, error, count } = await query
    .order(sortColumn, { ascending: sortDir === 'asc' })
    .range(from, to)

  if (error) throw error
  return { data: (data ?? []) as Document[], count: count ?? 0 }
}

export async function getDocumentById(id: string): Promise<Document | null> {
  const { data } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', id)
    .single()
  return data as Document | null
}

export async function deleteDocument(_supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('documents').delete().eq('id', id)
  if (error) throw error
}

export async function getDocumentSignedUrl(filePath: string): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: filePath }),
    { expiresIn: 3600 }
  )
}
