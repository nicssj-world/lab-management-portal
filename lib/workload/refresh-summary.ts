import { supabaseAdmin } from '@/lib/supabase/admin'
import { invalidateAnalysisCache } from '@/lib/analysis-cache'

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

  const heatmap = await supabaseAdmin.rpc('refresh_lab_workload_heatmap_month', {
    p_year: year,
    p_month: month,
  })

  if (heatmap.error && !['42883', '42P01', 'PGRST202'].includes(heatmap.error.code ?? '')) {
    throw new Error(heatmap.error.message)
  }

  await invalidateAnalysisCache(year > 2400 ? year - 543 : year, month)
}
