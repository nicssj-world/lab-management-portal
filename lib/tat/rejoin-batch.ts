import { supabaseAdmin } from '@/lib/supabase/admin'

const PAGE_SIZE = 100
const UPSERT_SIZE = 25

interface PhlebRow {
  hn: string | null
  register_at: string | null
  queue_confirmed_at: string | null
  phleb_done_at: string | null
  wait_minutes: number | null
  draw_minutes: number | null
  labzone_name: string | null
  phlebotomist: string | null
  phleb_date: string | null
  _done?: number
}

interface TatBloodRow {
  id: string
  year: number
  month: number
  hn: string | null
  register_at: string | null
  spcm_at: string | null
  rslt_at: string | null
}

interface TatUpdate {
  id: string
  year: number
  month: number
  register_at: string | null
  queue_confirmed_at: string | null
  phleb_done_at: string | null
  phleb_wait_minutes: number | null
  phleb_draw_minutes: number | null
  transport_minutes: number | null
  total_tat_minutes: number | null
  labzone_name: string | null
  phlebotomist: string | null
  match_confidence: 'exact' | 'ambiguous' | 'no_match'
}

export interface RejoinTatBatchResult {
  processed: number
  updated: number
  matched: number
  exact: number
  ambiguous: number
}

export interface RejoinTatStepResult extends RejoinTatBatchResult {
  done: boolean
  nextCursor: string | null
}

function isMissingRpcFunction(error: { message?: string; code?: string } | null) {
  return error?.code === '42883'
    || (error?.message ?? '').includes('function rejoin_tat')
    || (error?.message ?? '').includes('Could not find the function')
}

function isStatementTimeout(error: { message?: string; code?: string } | null) {
  return error?.code === '57014'
    || (error?.message ?? '').toLowerCase().includes('statement timeout')
}

async function countTatRows(year: number, month: number, extra?: Record<string, unknown>) {
  let query = supabaseAdmin
    .from('tat_records')
    .select('id', { count: 'exact', head: true })
    .eq('year', year)
    .eq('month', month)

  for (const [key, value] of Object.entries(extra ?? {})) {
    query = query.eq(key, value)
  }

  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function rejoinTatRpc(year: number, month: number): Promise<RejoinTatBatchResult | null> {
  const { error } = await supabaseAdmin.rpc('rejoin_tat', {
    p_year: year,
    p_month: month,
  })

  if (isMissingRpcFunction(error) || isStatementTimeout(error)) return null
  if (error) throw new Error(error.message)

  const [processed, exact, ambiguous] = await Promise.all([
    countTatRows(year, month, { is_blood_draw: true }),
    countTatRows(year, month, { is_blood_draw: true, match_confidence: 'exact' }),
    countTatRows(year, month, { is_blood_draw: true, match_confidence: 'ambiguous' }),
  ])

  return {
    processed,
    updated: exact + ambiguous,
    matched: exact + ambiguous,
    exact,
    ambiguous,
  }
}

async function fetchAll<T>(table: string, select: string, year: number, month: number, extra?: Record<string, unknown>): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabaseAdmin
      .from(table)
      .select(select)
      .eq('year', year)
      .eq('month', month)
      .range(from, from + PAGE_SIZE - 1)

    for (const [key, value] of Object.entries(extra ?? {})) {
      query = query.eq(key, value)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE_SIZE) break
  }

  return rows
}

async function fetchTatBloodPage(year: number, month: number, limit: number, afterId?: string | null): Promise<TatBloodRow[]> {
  let query = supabaseAdmin
    .from('tat_records')
    .select('id,year,month,hn,register_at,spcm_at,rslt_at')
    .eq('year', year)
    .eq('month', month)
    .eq('is_blood_draw', true)
    .order('id', { ascending: true })
    .limit(limit)

  if (afterId) query = query.gt('id', afterId)

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return (data ?? []) as TatBloodRow[]
}

async function upsertTatUpdates(updates: TatUpdate[]) {
  for (let i = 0; i < updates.length; i += UPSERT_SIZE) {
    const { error } = await supabaseAdmin
      .from('tat_records')
      .upsert(updates.slice(i, i + UPSERT_SIZE), { onConflict: 'id' })

    if (error) throw new Error(error.message)
  }
}

function toMs(value: string | null): number {
  return value ? new Date(value).getTime() : Number.NaN
}

function lowerBound(rows: PhlebRow[], targetMs: number) {
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((rows[mid]._done ?? 0) < targetMs) lo = mid + 1
    else hi = mid
  }
  return lo
}

function minutes(endMs: number, startMs: number) {
  return Number(((endMs - startMs) / 60000).toFixed(6))
}

function findNearestPhleb(rows: PhlebRow[], spcmMs: number): PhlebRow | null {
  const minMs = spcmMs - 480 * 60000
  const maxMs = spcmMs + 120 * 60000
  const idx = lowerBound(rows, spcmMs)
  let best: PhlebRow | null = null
  let bestAbs = Number.POSITIVE_INFINITY

  const consider = (row: PhlebRow | undefined) => {
    const done = row?._done
    if (!row || !done || done < minMs || done > maxMs) return
    const diff = Math.abs(spcmMs - done)
    if (diff < bestAbs) {
      best = row
      bestAbs = diff
    }
  }

  consider(rows[idx - 1])
  consider(rows[idx])
  consider(rows[idx + 1])

  for (let i = idx - 2; i >= 0 && (rows[i]._done ?? 0) >= minMs; i--) {
    const done = rows[i]._done ?? 0
    const diff = Math.abs(spcmMs - done)
    if (diff < bestAbs) consider(rows[i])
    else if (done < spcmMs && diff > bestAbs) break
  }

  for (let i = idx + 2; i < rows.length && (rows[i]._done ?? 0) <= maxMs; i++) {
    const done = rows[i]._done ?? 0
    const diff = Math.abs(spcmMs - done)
    if (diff < bestAbs) consider(rows[i])
    else if (done > spcmMs && diff > bestAbs) break
  }

  return best
}

async function buildPhlebIndex(year: number, month: number) {
  const phlebRows = await fetchAll<PhlebRow>(
    'phlebotomy_records',
    'hn,register_at,queue_confirmed_at,phleb_done_at,wait_minutes,draw_minutes,labzone_name,phlebotomist,phleb_date',
    year,
    month,
  )

  const byHn = new Map<string, PhlebRow[]>()
  const duplicateVisit = new Map<string, number>()

  for (const row of phlebRows) {
    if (!row.hn || !row.phleb_done_at) continue
    row._done = toMs(row.phleb_done_at)
    if (!Number.isFinite(row._done)) continue

    if (!byHn.has(row.hn)) byHn.set(row.hn, [])
    byHn.get(row.hn)!.push(row)

    const key = `${row.hn}|${row.phleb_date ?? ''}`
    duplicateVisit.set(key, (duplicateVisit.get(key) ?? 0) + 1)
  }

  for (const rows of byHn.values()) {
    rows.sort((a, b) => (a._done ?? 0) - (b._done ?? 0))
  }

  return { byHn, duplicateVisit }
}

async function processTatRows(
  tatRows: TatBloodRow[],
  resetUnmatched: boolean,
  byHn: Map<string, PhlebRow[]>,
  duplicateVisit: Map<string, number>,
) {
  let processed = 0
  let updated = 0
  let exact = 0
  let ambiguous = 0
  const updates: TatUpdate[] = []

  processed += tatRows.length

  for (const tat of tatRows) {
    const spcmMs = toMs(tat.spcm_at)
    const phleb = tat.hn && Number.isFinite(spcmMs)
      ? findNearestPhleb(byHn.get(tat.hn) ?? [], spcmMs)
      : null

    if (!phleb) {
      if (resetUnmatched) {
        updates.push({
          id: tat.id,
          year: tat.year,
          month: tat.month,
          register_at: null,
          queue_confirmed_at: null,
          phleb_done_at: null,
          phleb_wait_minutes: null,
          phleb_draw_minutes: null,
          transport_minutes: null,
          total_tat_minutes: null,
          labzone_name: null,
          phlebotomist: null,
          match_confidence: 'no_match',
        })
      }
      continue
    }

    const registerMs = toMs(tat.register_at)
    const queueConfirmedAt = phleb.queue_confirmed_at ?? phleb.register_at
    const queueMs = toMs(queueConfirmedAt)
    const resultMs = toMs(tat.rslt_at)
    const isAmbiguous = (duplicateVisit.get(`${phleb.hn}|${phleb.phleb_date ?? ''}`) ?? 1) > 1
    if (isAmbiguous) ambiguous += 1
    else exact += 1

    updates.push({
      id: tat.id,
      year: tat.year,
      month: tat.month,
      register_at: tat.register_at,
      queue_confirmed_at: queueConfirmedAt,
      phleb_done_at: phleb.phleb_done_at,
      phleb_wait_minutes: Number.isFinite(registerMs) && Number.isFinite(queueMs)
        ? minutes(queueMs, registerMs)
        : null,
      phleb_draw_minutes: phleb.draw_minutes ?? phleb.wait_minutes,
      transport_minutes: minutes(spcmMs, phleb._done ?? spcmMs),
      total_tat_minutes: Number.isFinite(resultMs) && Number.isFinite(registerMs)
        ? minutes(resultMs, registerMs)
        : null,
      labzone_name: phleb.labzone_name,
      phlebotomist: phleb.phlebotomist,
      match_confidence: isAmbiguous ? 'ambiguous' : 'exact',
    })
  }

  if (updates.length > 0) {
    await upsertTatUpdates(updates)
    updated += updates.length
  }

  return { processed, updated, matched: exact + ambiguous, exact, ambiguous }
}

export async function rejoinTatBatchStep(
  year: number,
  month: number,
  cursor: string | null,
  resetUnmatched = false,
): Promise<RejoinTatStepResult> {
  const { byHn, duplicateVisit } = await buildPhlebIndex(year, month)
  const tatRows = await fetchTatBloodPage(year, month, PAGE_SIZE, cursor)
  const result = await processTatRows(tatRows, resetUnmatched, byHn, duplicateVisit)
  return {
    ...result,
    done: tatRows.length < PAGE_SIZE,
    nextCursor: tatRows.at(-1)?.id ?? cursor ?? null,
  }
}

export async function rejoinTatBatch(year: number, month: number, resetUnmatched = false): Promise<RejoinTatBatchResult> {
  if (resetUnmatched && process.env.TAT_REJOIN_USE_RPC === '1') {
    const rpcResult = await rejoinTatRpc(year, month)
    if (rpcResult) return rpcResult
  }

  const { byHn, duplicateVisit } = await buildPhlebIndex(year, month)
  let cursor: string | null = null
  let processed = 0
  let updated = 0
  let exact = 0
  let ambiguous = 0

  for (;;) {
    const tatRows = await fetchTatBloodPage(year, month, PAGE_SIZE, cursor)
    const result = await processTatRows(tatRows, resetUnmatched, byHn, duplicateVisit)
    processed += result.processed
    updated += result.updated
    exact += result.exact
    ambiguous += result.ambiguous
    if (tatRows.length < PAGE_SIZE) break
    cursor = tatRows.at(-1)?.id ?? cursor
  }

  return {
    processed,
    updated,
    matched: exact + ambiguous,
    exact,
    ambiguous,
  }
}
