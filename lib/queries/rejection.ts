import { SupabaseClient } from '@supabase/supabase-js'

// ⚠️ PRIVACY: never expose dspname, hn, an, ln to client
export type RejectionLog = {
  id: string
  spcmdate: string
  labspcmnm: string | null
  itemno: number
  reject: string | null
  reason: string | null
  reason_normalized?: string | null
  reason_category?: string | null
  reason_confidence?: number | null
  reason_analysis_source?: string | null
  reason_rollup_reject?: string | null
  work: string | null
  ward: string | null
  uploaded_at: string
}

export type RejectionUpload = {
  id: string
  filename: string
  data_month: string | null
  total_rows: number
  inserted: number
  skipped: number
  uploaded_at: string
}

export type RejectionSummary = {
  current_total: number
  prev_total: number
  by_reason: { reason: string; total: number }[]
  by_reason_prev: { reason: string; total: number }[]
  by_reason_detail: { label: string; total: number }[]
  by_section: { section: string; total: number }[]
  by_specimen: { specimen: string; total: number }[]
  by_ward: { ward: string; total: number }[]
  monthly_trend: { month: string; total: number }[]
  yearly_trend: { yr: number; total: number }[]
  yearly_by_reason: { yr: number; reason: string; total: number }[]
  yearly_by_section: { yr: number; section: string; total: number }[]
  monthly_by_year: { yr: number; mo: number; total: number }[]
}

export type RejectionFilters = {
  year?: number
  month?: number
  reject?: string
  page?: number
  limit?: number
}

function postgrestQuoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

// ⚠️ select only non-PII columns — never select dspname/hn/an/ln
export async function getRejectionLogs(
  supabase: SupabaseClient,
  filters: RejectionFilters
) {
  const { year, month, reject, page = 1, limit = 50 } = filters
  let q = supabase
    .from('rejection_logs')
    .select('id,spcmdate,labspcmnm,itemno,reject,reason,reason_normalized,reason_category,reason_confidence,reason_analysis_source,reason_rollup_reject,work,ward,uploaded_at', { count: 'exact' })

  if (year && month) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = new Date(year, month, 0).toISOString().split('T')[0]
    q = q.gte('spcmdate', start).lte('spcmdate', end)
  }
  if (reject) {
    if (reject === 'อื่นๆ') {
      // The main summary now shows only unresolved "อื่นๆ" rows. Keep the
      // monthly table consistent with that normalized count.
      q = q.eq('reject', 'อื่นๆ').is('reason_rollup_reject', null)
    } else {
      // Include both native rows and "อื่นๆ" rows that were conservatively
      // rolled into this existing main Reject label.
      const selected = postgrestQuoted(reject)
      const other = postgrestQuoted('อื่นๆ')
      q = q.or(`reject.eq.${selected},and(reject.eq.${other},reason_rollup_reject.eq.${selected})`)
    }
  }

  return q
    .order('spcmdate', { ascending: false })
    .order('uploaded_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)
}
