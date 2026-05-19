import type { SupabaseClient } from '@supabase/supabase-js'
import type { TATEntry, TATImportBatch } from '@/lib/supabase/types'

const DEFAULT_TARGET_MINUTES = 240

export interface TATSummary {
  avgTAT: number
  pctOnTarget: number
  totalSamples: number
  peakHour: number
  changeVsLastMonth: number | null
}

export async function getTATSummary(
  supabase: SupabaseClient,
  year: number,
  month: number,
  dept?: string
): Promise<TATSummary> {
  let query = supabase
    .from('tat_entries')
    .select('tat_minutes, received_at')
    .eq('fiscal_year', year)
    .eq('month', month)

  if (dept) query = query.eq('dept_code', dept)

  const { data, error } = await query
  if (error) throw error
  const rows = data ?? []

  if (rows.length === 0) {
    return { avgTAT: 0, pctOnTarget: 0, totalSamples: 0, peakHour: 0, changeVsLastMonth: null }
  }

  const total = rows.length
  const avgTAT = Math.round(rows.reduce((s, r) => s + (r.tat_minutes ?? 0), 0) / total)
  const onTarget = rows.filter((r) => (r.tat_minutes ?? 0) <= DEFAULT_TARGET_MINUTES).length
  const pctOnTarget = Math.round((onTarget / total) * 100 * 10) / 10

  const hourCounts = new Array(24).fill(0)
  for (const r of rows) {
    const h = new Date(r.received_at).getHours()
    hourCounts[h]++
  }
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts))

  return { avgTAT, pctOnTarget, totalSamples: total, peakHour, changeVsLastMonth: null }
}

export interface TATTrendRow { month: number; avgTAT: number; sampleCount: number }

export async function getTATTrend(
  supabase: SupabaseClient,
  year: number,
  dept?: string
): Promise<TATTrendRow[]> {
  let query = supabase
    .from('tat_entries')
    .select('month, tat_minutes')
    .eq('fiscal_year', year)

  if (dept) query = query.eq('dept_code', dept)

  const { data, error } = await query
  if (error) throw error

  const grouped = new Map<number, { sum: number; count: number }>()
  for (const r of data ?? []) {
    const g = grouped.get(r.month) ?? { sum: 0, count: 0 }
    g.sum += r.tat_minutes ?? 0
    g.count++
    grouped.set(r.month, g)
  }

  return Array.from(grouped.entries()).map(([month, g]) => ({
    month,
    avgTAT: g.count > 0 ? Math.round(g.sum / g.count) : 0,
    sampleCount: g.count,
  })).sort((a, b) => a.month - b.month)
}

export interface TATDeptRow { deptCode: string; avgTAT: number; sampleCount: number }

export async function getTATByDept(
  supabase: SupabaseClient,
  year: number,
  month: number
): Promise<TATDeptRow[]> {
  const { data, error } = await supabase
    .from('tat_entries')
    .select('dept_code, tat_minutes')
    .eq('fiscal_year', year)
    .eq('month', month)
  if (error) throw error

  const grouped = new Map<string, { sum: number; count: number }>()
  for (const r of data ?? []) {
    const code = r.dept_code ?? 'Unknown'
    const g = grouped.get(code) ?? { sum: 0, count: 0 }
    g.sum += r.tat_minutes ?? 0
    g.count++
    grouped.set(code, g)
  }

  return Array.from(grouped.entries()).map(([code, g]) => ({
    deptCode: code,
    avgTAT: g.count > 0 ? Math.round(g.sum / g.count) : 0,
    sampleCount: g.count,
  }))
}

export async function getTATHeatmap(
  supabase: SupabaseClient,
  year: number,
  month: number,
  dept?: string
): Promise<Pick<TATEntry, 'received_at'>[]> {
  let query = supabase
    .from('tat_entries')
    .select('received_at')
    .eq('fiscal_year', year)
    .eq('month', month)
  if (dept) query = query.eq('dept_code', dept)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export interface TATBucket { bucket: string; count: number }

export async function getTATDistribution(
  supabase: SupabaseClient,
  year: number,
  month: number,
  dept?: string
): Promise<TATBucket[]> {
  let query = supabase
    .from('tat_entries')
    .select('tat_minutes')
    .eq('fiscal_year', year)
    .eq('month', month)
  if (dept) query = query.eq('dept_code', dept)
  const { data, error } = await query
  if (error) throw error

  const buckets: Record<string, number> = { '<30': 0, '30-60': 0, '1-2h': 0, '2-4h': 0, '4-8h': 0, '>8h': 0 }
  for (const r of data ?? []) {
    const m = r.tat_minutes ?? 0
    if (m < 30) buckets['<30']++
    else if (m < 60) buckets['30-60']++
    else if (m < 120) buckets['1-2h']++
    else if (m < 240) buckets['2-4h']++
    else if (m < 480) buckets['4-8h']++
    else buckets['>8h']++
  }

  return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }))
}

export interface TATBatchResult { batchId: number; insertedCount: number; skippedCount: number }

export async function insertTATBatch(
  supabase: SupabaseClient,
  batchMeta: { filename: string; fiscal_year: number; month: number; imported_by?: string },
  entries: Omit<TATEntry, 'id' | 'batch_id' | 'tat_minutes'>[]
): Promise<TATBatchResult> {
  // Insert batch header first to get ID
  const { data: batch, error: batchError } = await supabase
    .from('tat_import_batches')
    .insert({ ...batchMeta, row_count: 0 })
    .select()
    .single()
  if (batchError) throw batchError

  // Insert entries with batch_id
  const withBatch = entries.map((e) => ({ ...e, batch_id: batch.id }))
  const { data: inserted, error: insertError } = await supabase
    .from('tat_entries')
    .insert(withBatch)
    .select('id')
  if (insertError) throw insertError

  const insertedCount = inserted?.length ?? 0
  const skippedCount = entries.length - insertedCount

  // Update batch row_count
  await supabase.from('tat_import_batches').update({ row_count: insertedCount }).eq('id', batch.id)

  return { batchId: batch.id, insertedCount, skippedCount }
}

export async function checkExistingBatch(
  supabase: SupabaseClient,
  year: number,
  month: number
): Promise<TATImportBatch | null> {
  const { data } = await supabase
    .from('tat_import_batches')
    .select('*')
    .eq('fiscal_year', year)
    .eq('month', month)
    .order('created_at', { ascending: false })
    .limit(1)
  return data?.[0] ?? null
}
