import { supabaseAdmin } from '@/lib/supabase/admin'

export async function refreshLabWorkloadSummary(year: number, month: number) {
  const { error } = await supabaseAdmin.rpc('refresh_lab_workload_summary_month', {
    p_year: year,
    p_month: month,
  })

  // The workload dashboard still has a live aggregation fallback. If the
  // optional summary SQL has not been installed yet, do not block uploads.
  if (error && !['42883', '42P01'].includes(error.code ?? '')) {
    throw new Error(error.message)
  }
}
