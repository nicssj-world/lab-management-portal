import dotenv from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import {
  buddhistYearToCalendarYear,
  DRIVE_LEGACY_SOURCES,
  parseDriveWorkbook,
  type DriveLegacySource,
} from '../lib/it-verification/drive-sources'
import {
  buildLegacyImportPlan,
  type LegacyImportPlanItem,
  type LegacyImportSource,
} from '../lib/it-verification/legacy-import'
import { IT_DEPARTMENTS, type ItDepartmentCode } from '../lib/it-verification/domain'
import type { LegacyFormSheetResult } from '../lib/it-verification/legacy-form'

dotenv.config({ path: '.env.local' })
dotenv.config()

export const DEFAULT_DRIVE_YEARS = [2567, 2568, 2569] as const
const DEPARTMENT_CODES = IT_DEPARTMENTS.map((department) => department.code)

type LegacyRpcSample = {
  ln: string
  lis_to_his: LegacyFormSheetResult['samples'][number]['lisToHis']
  source_to_lis: LegacyFormSheetResult['samples'][number]['sourceToLis']
  remark: string
}

export type LegacyRpcPayload = {
  p_year: number
  p_quarter: 1 | 2 | 3 | 4
  p_department_id: number
  p_source_file_name: string
  p_source_file_id: string
  p_actor_id: string | null
  p_samples: LegacyRpcSample[]
  p_warning: string | null
}

function optionValue(argv: string[], option: string): string | null {
  const index = argv.indexOf(option)
  if (index < 0) return null
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value`)
  return value
}

export function parseRequestedYears(argv: string[]): number[] {
  const raw = optionValue(argv, '--years')
  const years = raw ? raw.split(',').map((value) => Number(value.trim())) : [...DEFAULT_DRIVE_YEARS]
  const unique = [...new Set(years)].sort((left, right) => left - right)
  if (unique.length === 0 || unique.some((year) => !Object.hasOwn(DRIVE_LEGACY_SOURCES, year))) {
    throw new Error(`Unsupported historical folder year. Choose from ${DEFAULT_DRIVE_YEARS.join(', ')}`)
  }
  return unique
}

function isUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

type LegacyRpcSource = Pick<LegacyFormSheetResult, 'year' | 'quarter' | 'departmentCode' | 'sourceFileName' | 'samples' | 'warnings'>

export function buildLegacyRpcPayload(
  quarter: LegacyRpcSource,
  sourceFileId: string,
  actorId: string | null,
  departmentId: number,
): LegacyRpcPayload {
  return {
    p_year: quarter.year,
    p_quarter: quarter.quarter,
    p_department_id: departmentId,
    p_source_file_name: quarter.sourceFileName,
    p_source_file_id: sourceFileId,
    p_actor_id: actorId,
    p_samples: quarter.samples.map((sample) => ({
      ln: sample.ln,
      lis_to_his: sample.lisToHis,
      source_to_lis: sample.sourceToLis,
      remark: sample.remark,
    })),
    p_warning: quarter.warnings.length > 0 ? quarter.warnings.join(' · ') : null,
  }
}

export async function downloadDriveSpreadsheet(
  spreadsheetId: string,
  fetcher: typeof fetch = fetch,
): Promise<Uint8Array> {
  const response = await fetcher(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`)
  if (!response.ok) throw new Error(`Unable to download Drive spreadsheet ${spreadsheetId}: HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error(`Drive spreadsheet ${spreadsheetId} did not return an XLSX file`)
  }
  return bytes
}

function sourceFileName(source: DriveLegacySource): string {
  return `[${source.departmentCode}] Fm-QP-LAB-24-02`
}

export async function loadDriveLegacySources(
  buddhistYears: number[],
  fetcher: typeof fetch = fetch,
): Promise<LegacyImportSource[]> {
  const sources: LegacyImportSource[] = []
  for (const buddhistYear of buddhistYears) {
    const folderYear = buddhistYearToCalendarYear(buddhistYear)
    for (const source of DRIVE_LEGACY_SOURCES[buddhistYear as keyof typeof DRIVE_LEGACY_SOURCES]) {
      const fileName = sourceFileName(source)
      const workbook = parseDriveWorkbook(await downloadDriveSpreadsheet(source.spreadsheetId, fetcher), {
        folderYear,
        departmentCode: source.departmentCode,
        sourceFileId: source.spreadsheetId,
        sourceFileName: fileName,
      })
      sources.push({ sourceFileId: source.spreadsheetId, sourceFileName: fileName, quarters: workbook })
    }
  }
  return sources
}

type DepartmentRow = { id: number; code: ItDepartmentCode }
type RoundRow = { id: string; year: number; quarter: number; department_id: number }
type RunRow = { round_id: string; sampling_method: string; algorithm: string; status: string }

async function getDepartmentRows(db: SupabaseClient): Promise<DepartmentRow[]> {
  const { data, error } = await db.from('departments').select('id, code').in('code', DEPARTMENT_CODES)
  if (error) throw new Error(`Unable to read verification departments: ${error.message}`)
  const rows = (data ?? []) as DepartmentRow[]
  if (rows.length !== DEPARTMENT_CODES.length) throw new Error('Verification departments are incomplete; apply the IT verification migration first')
  return rows
}

async function getExistingLegacyRunKeys(
  db: SupabaseClient,
  years: number[],
  departments: DepartmentRow[],
): Promise<Set<string>> {
  const { data: rounds, error: roundsError } = await db
    .from('it_verification_rounds')
    .select('id, year, quarter, department_id')
    .in('year', years)
    .in('department_id', departments.map((department) => department.id))
  if (roundsError) throw new Error(`Unable to read verification rounds; apply the IT verification migration first: ${roundsError.message}`)
  const roundRows = (rounds ?? []) as RoundRow[]
  if (roundRows.length === 0) return new Set()

  const { data: runs, error: runsError } = await db
    .from('it_verification_sampling_runs')
    .select('round_id, sampling_method, algorithm, status')
    .in('round_id', roundRows.map((round) => round.id))
    .eq('sampling_method', 'legacy_manual')
    .eq('algorithm', 'legacy-form-v1')
    .neq('status', 'void')
  if (runsError) throw new Error(`Unable to read historical verification runs: ${runsError.message}`)

  const codeById = new Map(departments.map((department) => [department.id, department.code]))
  const roundById = new Map(roundRows.map((round) => [round.id, round]))
  return new Set(((runs ?? []) as RunRow[]).flatMap((run) => {
    const round = roundById.get(run.round_id)
    const code = round ? codeById.get(round.department_id) : null
    return round && code ? [`${round.year}:${round.quarter}:${code}`] : []
  }))
}

function summarizePlan(plan: LegacyImportPlanItem[]) {
  return {
    rounds: plan.length,
    pendingRounds: plan.filter((item) => item.action === 'import').length,
    skippedRounds: plan.filter((item) => item.action === 'skip').length,
    pendingSamples: plan.filter((item) => item.action === 'import').reduce((total, item) => total + item.sampleCount, 0),
    noEvidenceDrafts: plan.filter((item) => item.action === 'import' && item.sampleCount === 0).length,
    warnings: plan.flatMap((item) => item.warning ? [`${item.departmentCode} Q${item.quarter} ${item.year}: ${item.warning}`] : []),
    issues: plan.flatMap((item) => item.issues.map((issue) => `${item.departmentCode} Q${item.quarter} ${item.year}: ${issue}`)),
  }
}

async function applyPlan(
  db: SupabaseClient,
  plan: LegacyImportPlanItem[],
  departments: DepartmentRow[],
  actorId: string,
) {
  const departmentByCode = new Map(departments.map((department) => [department.code, department]))
  const applied: Array<{ year: number; quarter: number; departmentCode: ItDepartmentCode; status: string; sampled: number }> = []
  for (const item of plan) {
    if (item.action === 'skip') continue
    const department = departmentByCode.get(item.departmentCode)
    if (!department) throw new Error(`Unknown verification department ${item.departmentCode}`)
    const payload = buildLegacyRpcPayload({
      year: item.year,
      quarter: item.quarter,
      departmentCode: item.departmentCode,
      sourceFileName: item.sourceFileName,
      samples: item.samples,
      warnings: item.warning ? [item.warning] : [],
    }, item.sourceFileId, actorId, department.id)
    const { data, error } = await db.rpc('import_it_verification_legacy_form', payload)
    if (error) throw new Error(`Legacy import failed for ${item.departmentCode} Q${item.quarter} ${item.year}: ${error.message}`)
    const result = data as { status?: string; sampled?: number } | null
    applied.push({
      year: item.year,
      quarter: item.quarter,
      departmentCode: item.departmentCode,
      status: result?.status ?? 'completed',
      sampled: result?.sampled ?? item.sampleCount,
    })
  }
  return applied
}

async function main() {
  const argv = process.argv.slice(2)
  const years = parseRequestedYears(argv)
  const shouldApply = argv.includes('--apply')
  const actorId = optionValue(argv, '--actor-id') || process.env.IT_VERIFICATION_IMPORT_ACTOR_ID || null
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  if (shouldApply && !isUuid(actorId)) throw new Error('--apply requires a valid --actor-id UUID (or IT_VERIFICATION_IMPORT_ACTOR_ID)')

  const sources = await loadDriveLegacySources(years)
  const db = createClient(
    supabaseUrl,
    serviceRoleKey,
    { auth: { persistSession: false } },
  )
  const departments = await getDepartmentRows(db)
  const existingRunKeys = await getExistingLegacyRunKeys(db, years.map(buddhistYearToCalendarYear), departments)
  const plan = buildLegacyImportPlan(sources, existingRunKeys)
  const summary = summarizePlan(plan)

  if (summary.issues.length > 0) {
    console.error(JSON.stringify({ mode: shouldApply ? 'apply-blocked' : 'dry-run', ...summary }, null, 2))
    throw new Error(`Historical import is blocked by ${summary.issues.length} validation issue(s)`)
  }
  if (!shouldApply) {
    console.log(JSON.stringify({ mode: 'dry-run', folderYears: years, ...summary }, null, 2))
    return
  }
  if (!isUuid(actorId)) throw new Error('--apply requires a valid --actor-id UUID (or IT_VERIFICATION_IMPORT_ACTOR_ID)')

  const applied = await applyPlan(db, plan, departments, actorId)
  console.log(JSON.stringify({ mode: 'apply', folderYears: years, ...summary, applied }, null, 2))
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
