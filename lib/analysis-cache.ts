import { supabaseAdmin } from '@/lib/supabase/admin'

const MISSING_CACHE_TABLE_CODES = new Set(['42P01', '42703'])
let cacheTableUnavailable = false

export type AnalysisCachePayload = Record<string, unknown>

function isMissingCacheTable(error: { code?: string } | null) {
  return !!error?.code && MISSING_CACHE_TABLE_CODES.has(error.code)
}

export async function readAnalysisCache<T extends AnalysisCachePayload>(
  endpoint: string,
  cacheKey: string,
): Promise<T | null> {
  if (cacheTableUnavailable) return null

  const { data, error } = await supabaseAdmin
    .from('analysis_summary_cache')
    .select('payload')
    .eq('endpoint', endpoint)
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (isMissingCacheTable(error)) {
    cacheTableUnavailable = true
    return null
  }
  if (error) return null
  return (data?.payload as T | undefined) ?? null
}

export async function writeAnalysisCache(
  endpoint: string,
  cacheKey: string,
  year: number,
  month: number,
  payload: AnalysisCachePayload,
  ttlMs: number,
) {
  if (cacheTableUnavailable) return

  const { error } = await supabaseAdmin
    .from('analysis_summary_cache')
    .upsert({
      endpoint,
      cache_key: cacheKey,
      year,
      month,
      payload,
      expires_at: new Date(Date.now() + ttlMs).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint,cache_key' })

  if (isMissingCacheTable(error)) {
    cacheTableUnavailable = true
    return
  }
}

export async function invalidateAnalysisCache(year: number, month: number) {
  if (cacheTableUnavailable) return

  const { error } = await supabaseAdmin
    .from('analysis_summary_cache')
    .delete()
    .eq('year', year)
    .eq('month', month)

  if (isMissingCacheTable(error)) {
    cacheTableUnavailable = true
    return
  }
}
