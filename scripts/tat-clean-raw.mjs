#!/usr/bin/env node
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })
dotenv.config()

const TAT_ENDPOINT = 'tat-summary'
const TAT_CACHE_VERSION = 'v2'
const WORKLOAD_ENDPOINT = 'lab-workload-summary'
const URGENT_PRIORITY = 'ด่วน'
const DELETE_BATCH_SIZE = 500
const VERIFICATION_SAMPLING_GO_LIVE = process.env.VERIFICATION_SAMPLING_GO_LIVE || '2026-09-01'
const VERIFICATION_DEPARTMENT_CODES = ['CHE', 'IMM', 'HEM', 'MIS', 'MIC', 'MOL', 'BLB']

function usage() {
  console.log(`
Usage:
  npm run tat:clean-raw -- --year 2026 --month 3 --dry-run
  npm run tat:clean-raw -- --year 2026 --month 3 --yes
  npm run tat:clean-raw -- --fiscal-year 2569 --dry-run

Options:
  --dry-run       Check cache and row counts without deleting
  --yes           Required for actual deletion
  --force         Skip cache checks

Verification guard:
  From ${VERIFICATION_SAMPLING_GO_LIVE}, every target department must have a
  successful/empty-population sampling run before raw rows can be deleted.
  --force bypasses this guard and writes a force-cleanup audit entry.
  VERIFICATION_SAMPLING_GO_LIVE may override the go-live date for controlled tests.

Keeps:
  analysis_summary_cache, tat_uploads, phleb_uploads

Deletes:
  tat_records, phlebotomy_records for the selected month(s)
`)
}

function args() {
  const out = {}
  for (let i = 2; i < process.argv.length; i++) {
    const token = process.argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = process.argv[i + 1]
    if (!next || next.startsWith('--')) {
      out[key] = true
      continue
    }
    out[key] = next
    i += 1
  }
  return out
}

function tatCacheKey(year, month, opts = {}) {
  return [
    TAT_CACHE_VERSION,
    year,
    month,
    opts.lab_section ?? '',
    opts.ward ?? '',
    opts.priority ?? '',
    opts.test_name ?? '',
    opts.labzone_name ?? '',
  ].join('|')
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function fiscalMonths(inputFiscalYear) {
  const raw = Number(inputFiscalYear)
  if (!Number.isInteger(raw)) throw new Error('--fiscal-year must be a number')
  const fiscalCeYear = raw > 2400 ? raw - 543 : raw
  return [
    ...[10, 11, 12].map(month => ({ year: fiscalCeYear - 1, month })),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(month => ({ year: fiscalCeYear, month })),
  ]
}

function selectedMonths(a) {
  if (a['fiscal-year']) return fiscalMonths(a['fiscal-year'])
  const year = Number(a.year)
  const month = Number(a.month)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Provide --year 2026 --month 3 or --fiscal-year 2569')
  }
  return [{ year, month }]
}

async function requireTatCache(supabase, year, month, priority) {
  const key = tatCacheKey(year, month, priority ? { priority } : {})
  const { data, error } = await supabase
    .from('analysis_summary_cache')
    .select('cache_key,updated_at,expires_at')
    .eq('endpoint', TAT_ENDPOINT)
    .eq('cache_key', key)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error) throw new Error(`cache check ${TAT_ENDPOINT} ${key}: ${error.message}`)
  return data ? { ok: true, key, updated_at: data.updated_at } : { ok: false, key }
}

async function requireWorkloadCache(supabase, year, month) {
  const { data, error } = await supabase
    .from('analysis_summary_cache')
    .select('cache_key,updated_at,expires_at')
    .eq('endpoint', WORKLOAD_ENDPOINT)
    .eq('year', year)
    .eq('month', month)
    .gt('expires_at', new Date().toISOString())
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(`cache check ${WORKLOAD_ENDPOINT} ${monthKey(year, month)}: ${error.message}`)
  const row = data?.[0]
  return row ? { ok: true, key: row.cache_key, updated_at: row.updated_at } : { ok: false }
}

async function validateCaches(supabase, year, month) {
  const [tatMain, tatUrgent, workload] = await Promise.all([
    requireTatCache(supabase, year, month),
    requireTatCache(supabase, year, month, URGENT_PRIORITY),
    requireWorkloadCache(supabase, year, month),
  ])

  const missing = []
  if (!tatMain.ok) missing.push(`TAT main (${tatMain.key})`)
  if (!tatUrgent.ok) missing.push(`TAT urgent (${tatUrgent.key})`)
  if (!workload.ok) missing.push('Workload monthly')

  return { ok: missing.length === 0, missing, tatMain, tatUrgent, workload }
}

function isVerificationGoLiveMonth(year, month) {
  return `${year}-${String(month).padStart(2, '0')}-01` >= VERIFICATION_SAMPLING_GO_LIVE
}

async function requireVerificationSampling(supabase, year, month) {
  const { data: upload, error: uploadError } = await supabase
    .from('tat_uploads')
    .select('id, year, month')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()
  if (uploadError) throw new Error(`verification upload check ${monthKey(year, month)}: ${uploadError.message}`)
  if (!upload) return { ok: true, reason: 'no-upload' }

  const quarter = Math.ceil(month / 3)
  const [{ data: departments, error: departmentError }, { data: rounds, error: roundError }] = await Promise.all([
    supabase.from('departments').select('id, code').in('code', VERIFICATION_DEPARTMENT_CODES),
    supabase.from('it_verification_rounds').select('id, department_id').eq('year', year).eq('quarter', quarter),
  ])
  if (departmentError) throw new Error(`verification department check: ${departmentError.message}`)
  if (roundError) throw new Error(`verification round check: ${roundError.message}`)
  const roundIds = (rounds || []).map(row => row.id)
  const { data: runs, error: runError } = roundIds.length === 0
    ? { data: [], error: null }
    : await supabase.from('it_verification_sampling_runs').select('round_id, status, attempt, warning').eq('upload_id', upload.id).in('round_id', roundIds)
  if (runError) throw new Error(`verification sampling check: ${runError.message}`)

  const departmentById = new Map((departments || []).map(row => [row.id, row.code]))
  const roundByDepartment = new Map((rounds || []).map(row => [row.department_id, row.id]))
  const latestRunByRound = new Map()
  for (const run of runs || []) {
    const previous = latestRunByRound.get(run.round_id)
    if (!previous || (run.attempt || 1) > (previous.attempt || 1)) latestRunByRound.set(run.round_id, run)
  }
  const missing = []
  for (const code of VERIFICATION_DEPARTMENT_CODES) {
    const departmentId = [...departmentById.entries()].find(([, value]) => value === code)?.[0]
    const roundId = departmentId == null ? null : roundByDepartment.get(departmentId)
    const run = roundId ? latestRunByRound.get(roundId) : null
    const hasUnmappedWarning = typeof run?.warning === 'string' && run.warning.includes('ยังไม่ map')
    if (!run || !['completed', 'skipped_existing', 'no_population'].includes(run.status) || hasUnmappedWarning) missing.push(code)
  }
  if (missing.length > 0) {
    throw new Error(`ยัง clean raw ไม่ได้: sampling ของ ${monthKey(year, month)} ยังไม่ครบ (${missing.join(', ')}) — ตรวจสอบหน้า IT Verification หรือใช้ --force อย่างระมัดระวัง`)
  }
  return { ok: true, reason: 'sampling-complete' }
}

async function recordForcedVerificationCleanup(supabase, year, month) {
  const { error } = await supabase.from('audit_log').insert({
    action: 'it_verification.raw_cleanup.force',
    user_id: null,
    target: monthKey(year, month),
    detail: `raw cleanup bypassed verification guard with --force after ${VERIFICATION_SAMPLING_GO_LIVE}`,
  })
  if (error) console.warn(`Could not write force-cleanup audit for ${monthKey(year, month)}: ${error.message}`)
}

async function countRows(supabase, table, year, month) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('year', year)
    .eq('month', month)

  if (error) throw new Error(`${table} count ${monthKey(year, month)}: ${error.message}`)
  return count ?? 0
}

async function deleteRowsByMonth(supabase, table, year, month) {
  let deleted = 0

  while (true) {
    const { data, error: selectError } = await supabase
      .from(table)
      .select('id')
      .eq('year', year)
      .eq('month', month)
      .limit(DELETE_BATCH_SIZE)

    if (selectError) throw new Error(`${table} select ${monthKey(year, month)}: ${selectError.message}`)
    const ids = (data ?? []).map(row => row.id).filter(Boolean)
    if (ids.length === 0) break

    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq('year', year)
      .eq('month', month)
      .in('id', ids)

    if (deleteError) throw new Error(`${table} delete ${monthKey(year, month)}: ${deleteError.message}`)
    deleted += ids.length
    process.stdout.write(`\r    ${table}: deleted ${deleted.toLocaleString()} rows`)
  }

  if (deleted > 0) process.stdout.write('\n')
  return deleted
}

async function main() {
  const a = args()
  if (a.help) {
    usage()
    return
  }

  const months = selectedMonths(a)
  const dryRun = Boolean(a['dry-run'])
  const yes = Boolean(a.yes)
  const force = Boolean(a.force)

  if (!dryRun && !yes) {
    usage()
    throw new Error('Actual deletion requires --yes. Run with --dry-run first.')
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const totals = {
    tat_records: 0,
    phlebotomy_records: 0,
  }

  console.log(`${dryRun ? 'Dry run' : 'Deleting raw rows'} for ${months.map(m => monthKey(m.year, m.month)).join(', ')}`)

  for (const { year, month } of months) {
    console.log(`\n${monthKey(year, month)}`)
    if (!force) {
      const cache = await validateCaches(supabase, year, month)
      if (!cache.ok) {
        throw new Error(`Cache is missing for ${monthKey(year, month)}: ${cache.missing.join(', ')}. Run tat:local first, or add --force.`)
      }
      console.log('  cache: OK')
    } else {
      console.log('  cache: skipped (--force)')
    }

    if (isVerificationGoLiveMonth(year, month)) {
      if (force) {
        console.warn(`  WARNING: verification sampling guard bypassed for ${monthKey(year, month)} with --force`)
        await recordForcedVerificationCleanup(supabase, year, month)
      } else {
        await requireVerificationSampling(supabase, year, month)
        console.log('  verification sampling: OK')
      }
    }

    const [tatCount, phlebCount] = await Promise.all([
      countRows(supabase, 'tat_records', year, month),
      countRows(supabase, 'phlebotomy_records', year, month),
    ])

    console.log(`  tat_records: ${tatCount.toLocaleString()}`)
    console.log(`  phlebotomy_records: ${phlebCount.toLocaleString()}`)

    if (dryRun) continue

    totals.tat_records += await deleteRowsByMonth(supabase, 'tat_records', year, month)
    totals.phlebotomy_records += await deleteRowsByMonth(supabase, 'phlebotomy_records', year, month)
  }

  if (dryRun) {
    console.log('\nNo rows deleted. Re-run with --yes to delete raw rows.')
  } else {
    console.log('\nDone.')
    console.log(`Deleted tat_records: ${totals.tat_records.toLocaleString()}`)
    console.log(`Deleted phlebotomy_records: ${totals.phlebotomy_records.toLocaleString()}`)
  }
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
