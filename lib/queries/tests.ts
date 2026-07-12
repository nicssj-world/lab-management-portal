import type { SupabaseClient } from '@supabase/supabase-js'
import type { Test, TestReferenceRange, TestDetail } from '@/lib/supabase/types'
import type { ReferenceRangeRow } from '@/lib/validations/test-schema'
import { orderRelatedTestDocuments, type RelatedTestDocument } from '@/lib/documents/related-test-documents'
import { normalizeDocumentAccess } from '@/lib/tests/document-access'

export interface TestFilters {
  category?: string
  search?: string
  popular?: boolean
  active?: boolean
  tube?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

const ALLOWED_SORT = ['code', 'cgd', 'th', 'en', 'price', 'tat_minutes', 'service', 'tube', 'updated_at']
const CUSTOM_SORT = ['display_name_alpha']

function getDisplayNameSortKey(test: Test): { group: number; key: string } {
  const raw = (test.th || test.en || test.code || '').trim()
  const withoutLeadingMarks = raw.replace(/^[^A-Za-z]+/, '')
  if (/^[A-Za-z]/.test(withoutLeadingMarks)) {
    return { group: 0, key: withoutLeadingMarks }
  }
  if (/^[0-9]/.test(raw)) {
    return { group: 1, key: raw }
  }
  return { group: 2, key: raw }
}

function compareDisplayName(a: Test, b: Test, ascending: boolean): number {
  const ak = getDisplayNameSortKey(a)
  const bk = getDisplayNameSortKey(b)
  const result = ak.group - bk.group
    || ak.key.localeCompare(bk.key, 'en', { sensitivity: 'base', numeric: true })
    || a.code.localeCompare(b.code, 'en', { sensitivity: 'base', numeric: true })
  return ascending ? result : -result
}

export async function getTests(
  supabase: SupabaseClient,
  filters: TestFilters = {}
): Promise<{ data: Test[]; count: number }> {
  const { category, search, popular, active, tube, page = 0, pageSize = 50, sortBy = 'code', sortDir = 'asc' } = filters
  const customSort = CUSTOM_SORT.includes(sortBy)

  const col = ALLOWED_SORT.includes(sortBy) ? sortBy : 'code'

  let query = supabase
    .from('tests')
    .select('*', { count: 'exact' })

  if (!customSort) {
    query = query
      .order(col, { ascending: sortDir === 'asc', nullsFirst: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)
  }

  if (active !== undefined) query = query.eq('active', active)
  if (category) query = query.eq('category_id', category)
  if (tube) query = query.eq('tube', tube)
  if (popular !== undefined) query = query.eq('popular', popular)
  if (search) {
    query = query.or(`th.ilike.%${search}%,en.ilike.%${search}%,code.ilike.%${search}%,cgd.ilike.%${search}%,loinc.ilike.%${search}%`)
  }
  if (customSort) query = query.range(0, 9999)

  const { data, error, count } = await query
  if (error) throw error
  if (customSort) {
    const sorted = [...(data ?? [])].sort((a, b) => compareDisplayName(a as Test, b as Test, sortDir === 'asc'))
    return {
      data: sorted.slice(page * pageSize, (page + 1) * pageSize),
      count: count ?? sorted.length,
    }
  }
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

export async function getTestByCatalogParam(supabase: SupabaseClient, param: string): Promise<Test | null> {
  const id = Number(param)
  if (Number.isInteger(id) && id > 0) {
    const { data, error } = await supabase
      .from('tests')
      .select('*, categories(*)')
      .eq('id', id)
      .single()
    if (!error) return data
  }

  return getTestByCode(supabase, param)
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

export async function getRelatedTestDocuments(
  supabase: SupabaseClient,
  relatedDocumentIds: readonly string[] | null | undefined,
  relatedDocumentAccess: Record<string, string> | null | undefined,
): Promise<RelatedTestDocument[]> {
  const ids = [...new Set(relatedDocumentIds ?? [])]
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('documents')
    .select('id, document_code, title, type, file_url, file_name, visibility')
    .is('deleted_at', null)
    .in('id', ids)

  if (error) throw error
  return orderRelatedTestDocuments(ids, data ?? []).map((document) => {
    const access = normalizeDocumentAccess(document.visibility, relatedDocumentAccess?.[document.id])
    return { ...document, visibility: access.visibility, accessMode: access.accessMode } as RelatedTestDocument
  })
}

export async function getTestDetail(supabase: SupabaseClient, id: number): Promise<TestDetail> {
  const { data: test, error: testError } = await supabase
    .from('tests').select('*, categories(*)').eq('id', id).single()
  if (testError) throw testError

  const [rangesRes, docsRes, relatedDocuments] = await Promise.all([
    supabase.from('test_reference_ranges').select('*').eq('test_id', id).order('sort_order'),
    supabase.from('test_documents').select('*').eq('test_id', id).order('created_at'),
    getRelatedTestDocuments(supabase, (test as Test).related_doc_ids, (test as Test).related_doc_access),
  ])
  return {
    test: test as Test,
    referenceRanges: (rangesRes.data ?? []) as TestReferenceRange[],
    documents: docsRes.data ?? [],
    relatedDocuments,
  }
}

export async function createTest(
  supabase: SupabaseClient,
  data: Record<string, unknown>,
  userId: string,
): Promise<Test> {
  const { data: row, error } = await supabase
    .from('tests')
    .insert({ ...data, created_by: userId, updated_by: userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select().single()
  if (error) throw error
  return row as Test
}

export async function updateTest(
  supabase: SupabaseClient,
  id: number,
  data: Record<string, unknown>,
  userId: string,
): Promise<Test> {
  const { data: row, error } = await supabase
    .from('tests')
    .update({ ...data, updated_by: userId, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return row as Test
}

export async function duplicateTest(
  supabase: SupabaseClient,
  id: number,
  userId: string,
): Promise<Test> {
  const { data: original, error: fetchErr } = await supabase.from('tests').select('*').eq('id', id).single()
  if (fetchErr) throw fetchErr
  const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = original as Test & Record<string, unknown>
  const newCode = `${rest.code}-COPY`
  const { data: row, error } = await supabase
    .from('tests')
    .insert({ ...rest, code: newCode, created_by: userId, updated_by: userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select().single()
  if (error) throw error
  const { data: ranges } = await supabase.from('test_reference_ranges').select('*').eq('test_id', id)
  if (ranges?.length) {
    await supabase.from('test_reference_ranges').insert(
      ranges.map(({ id: _rid, test_id: _tid, ...r }: TestReferenceRange) => ({ ...r, test_id: (row as Test).id }))
    )
  }
  return row as Test
}

export async function upsertReferenceRanges(
  supabase: SupabaseClient,
  testId: number,
  rows: ReferenceRangeRow[],
): Promise<void> {
  await supabase.from('test_reference_ranges').delete().eq('test_id', testId)
  if (rows.length === 0) return
  const { error } = await supabase.from('test_reference_ranges').insert(
    rows.map((r, i) => ({ ...r, test_id: testId, sort_order: i }))
  )
  if (error) throw error
}

export async function checkTestCodeExists(
  supabase: SupabaseClient,
  code: string,
  excludeId?: number,
): Promise<boolean> {
  let q = supabase.from('tests').select('id').eq('code', code)
  if (excludeId) q = q.neq('id', excludeId)
  const { data } = await q
  return (data?.length ?? 0) > 0
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
