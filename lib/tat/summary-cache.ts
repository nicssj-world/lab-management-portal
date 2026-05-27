import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAnalysisCache } from '@/lib/analysis-cache'

const CACHE_ENDPOINT = 'tat-summary'
const PERSISTENT_CACHE_TTL_MS = 12 * 60 * 60 * 1000
const CACHE_VERSION = 'v2'
const URGENT_PRIORITY = 'ด่วน'

function cacheKey(
  year: number,
  month: number,
  filters: {
    lab_section?: string | null
    ward?: string | null
    priority?: string | null
    test_name?: string | null
    labzone_name?: string | null
  } = {},
) {
  return [
    CACHE_VERSION,
    String(year),
    String(month),
    filters.lab_section ?? '',
    filters.ward ?? '',
    filters.priority ?? '',
    filters.test_name ?? '',
    filters.labzone_name ?? '',
  ].join('|')
}

async function warmOneTatSummary(year: number, month: number, priority: string | null) {
  const { data, error } = await supabaseAdmin.rpc('get_tat_summary', {
    p_year: year,
    p_month: month,
    p_lab_section: null,
    p_ward: null,
    p_priority: priority,
    p_test_name: null,
    p_labzone: null,
  })

  if (error) throw new Error(error.message)

  await writeAnalysisCache(
    CACHE_ENDPOINT,
    cacheKey(year, month, { priority }),
    year,
    month,
    data as Record<string, unknown>,
    PERSISTENT_CACHE_TTL_MS,
  )
}

export async function warmTatSummaryCache(year: number, month: number) {
  await Promise.all([
    warmOneTatSummary(year, month, null),
    warmOneTatSummary(year, month, URGENT_PRIORITY),
  ])
}
