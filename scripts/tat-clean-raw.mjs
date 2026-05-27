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
