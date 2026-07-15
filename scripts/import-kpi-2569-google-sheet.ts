import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { calcResult } from '../lib/kpi-utils'
import { extractKpi2569Sheet, type Kpi2569SourceEntry } from '../lib/kpi-import/google-sheet-2569'

dotenv.config({ path: '.env.local' })

const FISCAL_YEAR = 2569
const SPREADSHEET_ID = '1mD3DYhjhwoacFrthVh-LGwGCAa5PZ_zb-SskuKdqeOs'
const SHEET_TABS = ['CHE', 'IMM', 'HEM', 'MIS', 'MIC', 'MOL', 'BLB', 'OUT', 'MCL', 'OPD']
const shouldApply = process.argv.includes('--apply')

type Department = { id: number; code: string }
type Definition = { id: number; code: string }
type ExistingEntry = { dept_id: number; kpi_id: number; month: number; numerator: number | null }
type Exclusion = { dept_id: number; kpi_id: number }
type InsertEntry = {
  dept_id: number
  kpi_id: number
  fiscal_year: number
  month: number
  numerator: number
  denominator: number | null
  result_pct: number | null
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function entryKey(deptId: number, kpiId: number, month: number): string {
  return `${deptId}:${kpiId}:${FISCAL_YEAR}:${month}`
}

async function loadSourceEntries(): Promise<Kpi2569SourceEntry[]> {
  const response = await fetch(
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx`,
  )
  if (!response.ok) throw new Error(`Unable to download source spreadsheet: ${response.status}`)

  const workbook = XLSX.read(Buffer.from(await response.arrayBuffer()), { type: 'buffer' })
  const entries: Kpi2569SourceEntry[] = []

  for (const tab of SHEET_TABS) {
    const worksheet = workbook.Sheets[tab]
    if (!worksheet) throw new Error(`Source spreadsheet is missing required tab: ${tab}`)

    const rows = XLSX.utils.sheet_to_json<Array<unknown>>(worksheet, {
      header: 1,
      defval: null,
      raw: true,
    })
    entries.push(...extractKpi2569Sheet(tab, rows))
  }

  return entries
}

async function main() {
  const db = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const sourceEntries = await loadSourceEntries()
  const [departmentsResult, definitionsResult, existingResult, exclusionsResult] = await Promise.all([
    db.from('departments').select('id, code').eq('is_active', true),
    db.from('kpi_definitions').select('id, code'),
    db.from('kpi_entries').select('dept_id, kpi_id, month, numerator').eq('fiscal_year', FISCAL_YEAR),
    db.from('kpi_dept_exclusions').select('dept_id, kpi_id'),
  ])

  for (const result of [departmentsResult, definitionsResult, existingResult, exclusionsResult]) {
    if (result.error) throw result.error
  }

  const departments = departmentsResult.data as Department[]
  const definitions = definitionsResult.data as Definition[]
  const existingEntries = existingResult.data as ExistingEntry[]
  const exclusions = exclusionsResult.data as Exclusion[]
  const departmentByCode = new Map(departments.map((department) => [department.code, department]))
  const definitionByCode = new Map(definitions.map((definition) => [definition.code, definition]))
  const excluded = new Set(exclusions.map((item) => `${item.dept_id}:${item.kpi_id}`))
  const existingByKey = new Map(
    existingEntries.map((entry) => [entryKey(entry.dept_id, entry.kpi_id, entry.month), entry]),
  )
  const candidates = new Map<string, InsertEntry>()
  let skippedExcluded = 0
  let skippedExisting = 0

  for (const source of sourceEntries) {
    const department = departmentByCode.get(source.deptCode)
    const definition = definitionByCode.get(source.kpiCode)
    if (!department || !definition) {
      throw new Error(`Unknown source mapping: ${source.deptCode} / ${source.kpiCode}`)
    }
    if (excluded.has(`${department.id}:${definition.id}`)) {
      skippedExcluded += 1
      continue
    }

    const key = entryKey(department.id, definition.id, source.month)
    if (existingByKey.get(key)?.numerator !== null && existingByKey.has(key)) {
      skippedExisting += 1
      continue
    }
    if (candidates.has(key)) throw new Error(`Duplicate source value for ${source.deptCode} / ${source.kpiCode} / ${source.month}`)

    candidates.set(key, {
      dept_id: department.id,
      kpi_id: definition.id,
      fiscal_year: FISCAL_YEAR,
      month: source.month,
      numerator: source.numerator,
      denominator: source.denominator,
      result_pct: calcResult(source.numerator, source.denominator),
    })
  }

  const entries = [...candidates.values()]
  const summary = {
    mode: shouldApply ? 'apply' : 'dry-run',
    sourceRows: sourceEntries.length,
    skippedExcluded,
    skippedExisting,
    eligibleToInsert: entries.length,
  }

  if (!shouldApply) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  let inserted = 0
  let skippedConflict = 0
  for (const entry of entries) {
    const { error } = await db.from('kpi_entries').insert(entry)
    if (!error) {
      inserted += 1
      continue
    }
    if (error.code === '23505') {
      skippedConflict += 1
      continue
    }
    throw error
  }

  const { data: savedRows, error: verificationError } = await db
    .from('kpi_entries')
    .select('dept_id, kpi_id, month, numerator')
    .eq('fiscal_year', FISCAL_YEAR)
  if (verificationError) throw verificationError

  const savedByKey = new Map(
    (savedRows as ExistingEntry[]).map((entry) => [entryKey(entry.dept_id, entry.kpi_id, entry.month), entry]),
  )
  const missingInsert = entries.filter((entry) => {
    const saved = savedByKey.get(entryKey(entry.dept_id, entry.kpi_id, entry.month))
    return saved?.numerator !== entry.numerator
  })
  if (missingInsert.length > 0) {
    throw new Error(`Post-import verification failed for ${missingInsert.length} row(s)`)
  }

  console.log(JSON.stringify({ ...summary, inserted, skippedConflict, verified: entries.length }, null, 2))
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
