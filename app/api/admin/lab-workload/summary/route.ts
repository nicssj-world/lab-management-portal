import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { readAnalysisCache, writeAnalysisCache } from '@/lib/analysis-cache'
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'

const PAGE_SIZE = 1000
const CACHE_TTL_MS = 0
const PERSISTENT_CACHE_TTL_MS = 12 * 60 * 60 * 1000
const CACHE_ENDPOINT = 'lab-workload-summary'
const WORKLOAD_CACHE_VERSION = 'v18'
const WORKLOAD_MAP_FILE = 'workload-test-map-2569.xlsx'
const HEALTH_CENTER_SECTION = '\u0e28\u0e2a\u0e21.'
const CHEMISTRY_SECTION = '\u0e40\u0e04\u0e21\u0e35\u0e04\u0e25\u0e34\u0e19\u0e34\u0e01'
const MOLECULAR_SECTION = '\u0e2d\u0e13\u0e39\u0e1e\u0e31\u0e19\u0e18\u0e38\u0e28\u0e32\u0e2a\u0e15\u0e23\u0e4c'
const HEALTH_CENTER_RE = /(\u0e28\u0e2a\u0e21|\u0e23\u0e1e\.\u0e40\u0e21\u0e37\u0e2d\u0e07|\u0e23\u0e1e \u0e40\u0e21\u0e37\u0e2d\u0e07|green chanel)/i
const CAR_BED_LABZONE = 'ช่องรถนั่ง-นอน'
const CAR_BED_SOURCE_ZONES = ['ช่อง 10', 'ช่อง 11']
const PHLEB_ALLOWED_LABZONES = [
  'ห้องปฏิบัติการ ชั้น G',
  'ห้องปฏิบัติการ เมือง',
  'ห้องปฏิบัติการ นอกรพ.Central',
  'ห้องปฏิบัติการ สูติ-นรีเวชกรรม',
  'ห้องเจาะเลือด ชั้น 3',
  CAR_BED_LABZONE,
]

interface TatRow {
  id: string
  year: number
  month: number
  ln: string | null
  lab_section: string | null
  ward: string | null
  test_name: string | null
  name_1: string | null
  within_target: boolean | null
  spcm_hour: number | null
  spcm_dow: number | null
}

interface PhlebRow {
  id: string
  hn: string | null
  labzone_name: string | null
  register_at: string | null
}

interface WorkloadTestMeta {
  section: string
  test_name: string
  code: string | null
  price: number | null
}

type MatchedTatRow = TatRow & WorkloadTestMeta
type WorkloadRule = { section: string; test_name: string }[]

type MonthPair = { in_time: number; total: number; row_in_time: number; row_total: number }
type Payload = Record<string, unknown>
type SummaryRow = Record<string, any>
type UploadVersion = { row_count: number | null; uploaded_at: string | null }
type DepartmentSummary = { section: string; ln_count: number; test_rows: number; test_count: number }
type HeatCell = { dow: number; hour: number; count: number }
type HeatmapPayload = {
  heatmap: HeatCell[]
  phleb_heatmap: HeatCell[]
  warnings: string[]
}
type UploadHealth = {
  version: string
  warnings: string[]
  hasTatRecords: boolean
  hasPhlebRecords: boolean
}

const cache = new Map<string, { expiresAt: number; payload: Payload }>()
let workloadMatchersCache: ReturnType<typeof buildWorkloadMatchers> | null = null

function toGregorianYear(year: number) {
  return year > 2400 ? year - 543 : year
}

function fiscalMonths(fiscalYear: number) {
  return [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(month => ({
    year: month >= 10 ? fiscalYear - 1 : fiscalYear,
    month,
  }))
}

function mergeWarnings(...items: unknown[]) {
  return Array.from(new Set(items.flatMap((item) => Array.isArray(item) ? item.map(String) : [])))
}

function hasMissingHeatmapWarning(payload: Payload | null) {
  const warnings = payload?.warnings
  return Array.isArray(warnings) && warnings.some((warning) => {
    const message = String(warning)
    return message.includes('precomputed heatmap') || message.includes('API ยังไม่เห็นตาราง')
  })
}

function hasWorkloadRulesPayload(payload: Payload | null) {
  return !!payload
    && Array.isArray(payload.departments)
    && typeof payload.section_details === 'object'
    && payload.section_details !== null
    && !hasMissingHeatmapWarning(payload)
}

function hasWorkloadMonthValues(payload: Payload | null, year: number, month: number) {
  if (!hasWorkloadRulesPayload(payload)) return false
  const key = monthKey(year, month)
  const sections = Object.values((payload?.section_details ?? {}) as Record<string, unknown>)
  return sections.some((sectionRows) => Array.isArray(sectionRows) && sectionRows.some((row) => {
    const r = row as Record<string, any>
    const monthValue = r.months?.[key]
    return Number(monthValue?.total ?? 0) > 0
      || Number(monthValue?.row_total ?? 0) > 0
      || (payload?.selected_year === year && payload?.selected_month === month && Number(r.current_total ?? 0) > 0)
      || (payload?.selected_year === year && payload?.selected_month === month && Number(r.current_test_rows ?? 0) > 0)
  }))
}

function uploadWarningsForPayload(payload: Payload, uploadWarnings: string[], year: number, month: number) {
  if (payload.source === 'local-etl' && hasWorkloadMonthValues(payload, year, month)) return []
  return uploadWarnings
}

async function readLatestWorkloadPayload(year: number, month: number): Promise<Payload | null> {
  const { data, error } = await supabaseAdmin
    .from('analysis_summary_cache')
    .select('payload')
    .eq('endpoint', CACHE_ENDPOINT)
    .eq('year', year)
    .eq('month', month)
    .gt('expires_at', new Date().toISOString())
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) return null
  const rows = (data ?? []) as { payload: Payload | null }[]
  const payloads = rows.map(row => row.payload).filter(hasWorkloadRulesPayload)
  return payloads.find(payload => hasWorkloadMonthValues(payload, year, month))
    ?? payloads[0]
    ?? null
}

function applySelectedHeatmaps(payload: Payload, heatmaps: HeatmapPayload, uploadWarnings: string[], year: number, month: number) {
  return {
    ...payload,
    heatmap: heatmaps.heatmap.length ? heatmaps.heatmap : payload.heatmap,
    phleb_heatmap: heatmaps.phleb_heatmap.length ? heatmaps.phleb_heatmap : payload.phleb_heatmap,
    warnings: mergeWarnings(payload.warnings, uploadWarningsForPayload(payload, uploadWarnings, year, month), heatmaps.heatmap.length || heatmaps.phleb_heatmap.length ? [] : heatmaps.warnings),
  }
}

async function fetchUploadHealth(year: number, month: number): Promise<UploadHealth> {
  const [tatRes, phlebRes, tatCountRes, phlebCountRes] = await Promise.all([
    supabaseAdmin
      .from('tat_uploads')
      .select('row_count,uploaded_at')
      .eq('year', year)
      .eq('month', month)
      .maybeSingle(),
    supabaseAdmin
      .from('phleb_uploads')
      .select('row_count,uploaded_at')
      .eq('year', year)
      .eq('month', month)
      .maybeSingle(),
    supabaseAdmin
      .from('tat_records')
      .select('id')
      .eq('year', year)
      .eq('month', month)
      .limit(1),
    supabaseAdmin
      .from('phlebotomy_records')
      .select('id')
      .eq('year', year)
      .eq('month', month)
      .limit(1),
  ])

  if (tatRes.error) throw new Error(tatRes.error.message)
  if (phlebRes.error) throw new Error(phlebRes.error.message)
  if (tatCountRes.error) throw new Error(tatCountRes.error.message)
  if (phlebCountRes.error) throw new Error(phlebCountRes.error.message)

  const tat = (tatRes.data ?? { row_count: 0, uploaded_at: 'none' }) as UploadVersion
  const phleb = (phlebRes.data ?? { row_count: 0, uploaded_at: 'none' }) as UploadVersion
  const hasTatRecords = (tatCountRes.data?.length ?? 0) > 0
  const hasPhlebRecords = (phlebCountRes.data?.length ?? 0) > 0
  const warnings: string[] = []

  if ((tat.row_count ?? 0) > 0 && !hasTatRecords) {
    warnings.push('พบประวัติอัปโหลดไฟล์ TAT แต่ยังไม่มี records จริง กรุณาอัปโหลดไฟล์ TAT เดือนนี้ใหม่ให้จบ')
  }
  if ((phleb.row_count ?? 0) > 0 && !hasPhlebRecords) {
    warnings.push('พบประวัติอัปโหลดไฟล์เจาะเลือด แต่ยังไม่มี records จริง กรุณาอัปโหลดไฟล์เจาะเลือดเดือนนี้ใหม่ให้จบ')
  }

  return {
    version: `tat:${hasTatRecords ? 'has-records' : 'empty'}:${tat.uploaded_at ?? 'none'}|phleb:${hasPhlebRecords ? 'has-records' : 'empty'}:${phleb.uploaded_at ?? 'none'}`,
    warnings,
    hasTatRecords,
    hasPhlebRecords,
  }
}

function emptyPayload(
  displayFiscalYear: number,
  selectedYear: number,
  selectedMonth: number,
  months: { year: number; month: number }[],
  warnings: string[],
): Payload {
  return {
    fiscal_year: displayFiscalYear,
    selected_year: selectedYear,
    selected_month: selectedMonth,
    months,
    kpi: {
      total_ln: 0,
      total_test_rows: 0,
      department_count: 0,
      opd_hn: 0,
    },
    departments: [],
    trend: months.map(ym => ({ year: ym.year, month: ym.month, ln_count: 0, test_rows: 0 })),
    heatmap: [],
    phlebotomy_zones: [],
    opd_rows: [],
    phleb_heatmap: [],
    section_details: {},
    warnings,
  }
}

async function fetchTatRows(months: { year: number; month: number }[]) {
  const rows: TatRow[] = []

  for (const ym of months) {
    let cursor: string | null = null
    for (;;) {
      let query = supabaseAdmin
        .from('tat_records')
        .select('id,year,month,ln,lab_section,ward,test_name,name_1,within_target,spcm_hour,spcm_dow')
        .eq('year', ym.year)
        .eq('month', ym.month)
        .order('id', { ascending: true })
        .limit(PAGE_SIZE)
      if (cursor) query = query.gt('id', cursor)

      let { data, error } = await query

      if (error && error.message.toLowerCase().includes('name_1')) {
        let fallbackQuery = supabaseAdmin
          .from('tat_records')
          .select('id,year,month,ln,lab_section,ward,test_name,within_target,spcm_hour,spcm_dow')
          .eq('year', ym.year)
          .eq('month', ym.month)
          .order('id', { ascending: true })
          .limit(PAGE_SIZE)
        if (cursor) fallbackQuery = fallbackQuery.gt('id', cursor)
        const fallback = await fallbackQuery
        data = fallback.data ? fallback.data.map(row => ({ ...row, name_1: null })) : null
        error = fallback.error
      }

      if (error) throw new Error(error.message)
      const page = (data ?? []) as TatRow[]
      rows.push(...page)
      if (page.length < PAGE_SIZE) break
      cursor = page[page.length - 1]?.id ?? null
      if (!cursor) break
    }
  }

  return rows
}

async function fetchPhlebRows(year: number, month: number) {
  const rows: PhlebRow[] = []

  let cursor: string | null = null
  for (;;) {
    let query = supabaseAdmin
      .from('phlebotomy_records')
      .select('id,hn,labzone_name,register_at')
      .eq('year', year)
      .eq('month', month)
      .order('id', { ascending: true })
      .limit(PAGE_SIZE)
    if (cursor) query = query.gt('id', cursor)

    const { data, error } = await query

    if (error) throw new Error(error.message)
    const page = (data ?? []) as PhlebRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    cursor = page[page.length - 1]?.id ?? null
    if (!cursor) break
  }

  return rows
}

async function fetchPhlebRowsForMonths(months: { year: number; month: number }[]) {
  const rows: (PhlebRow & { year: number; month: number })[] = []

  for (const ym of months) {
    let cursor: string | null = null
    for (;;) {
      let query = supabaseAdmin
        .from('phlebotomy_records')
        .select('id,year,month,hn,labzone_name,register_at')
        .eq('year', ym.year)
        .eq('month', ym.month)
        .order('id', { ascending: true })
        .limit(PAGE_SIZE)
      if (cursor) query = query.gt('id', cursor)

      const { data, error } = await query

      if (error) throw new Error(error.message)
      const page = (data ?? []) as (PhlebRow & { year: number; month: number })[]
      rows.push(...page)
      if (page.length < PAGE_SIZE) break
      cursor = page[page.length - 1]?.id ?? null
      if (!cursor) break
    }
  }

  return rows
}

function toHeatCells(value: unknown): HeatCell[] {
  return Array.isArray(value)
    ? value
      .map((row) => {
        const r = row as Partial<HeatCell>
        return {
          dow: Number(r.dow),
          hour: Number(r.hour),
          count: Number(r.count),
        }
      })
      .filter((row) => Number.isFinite(row.dow) && Number.isFinite(row.hour) && Number.isFinite(row.count))
    : []
}

async function fetchHeatmaps(year: number, month: number): Promise<HeatmapPayload> {
  const [tatRes, phlebRes] = await Promise.all([
    supabaseAdmin
      .from('lab_workload_heatmap_monthly')
      .select('dow,hour,count')
      .eq('year', year)
      .eq('month', month),
    supabaseAdmin
      .from('lab_workload_phleb_heatmap_monthly')
      .select('dow,hour,count')
      .eq('year', year)
      .eq('month', month),
  ])

  const missingTable = [tatRes, phlebRes].some(res => ['42P01', 'PGRST205'].includes(res.error?.code ?? ''))
  if (missingTable) {
    return {
      heatmap: [],
      phleb_heatmap: [],
      warnings: ['โหลดข้อมูลหลักสำเร็จ แต่ API ยังไม่เห็นตาราง precomputed heatmap ให้รัน scripts/lab_workload_heatmap_patch.sql แล้ว reload schema'],
    }
  }
  const unexpectedError = [tatRes, phlebRes].find(res => res.error)
  if (unexpectedError?.error) {
    if (unexpectedError.error.code === '57014') {
      return {
        heatmap: [],
        phleb_heatmap: [],
        warnings: ['โหลดข้อมูลหลักสำเร็จ แต่ heatmap ใช้เวลานานเกินไป'],
      }
    }
    throw new Error(unexpectedError.error.message)
  }

  return {
    heatmap: toHeatCells(tatRes.data),
    phleb_heatmap: toHeatCells(phlebRes.data),
    warnings: [],
  }
}

function normalizeLabzone(name: string | null) {
  if (!name) return null
  return CAR_BED_SOURCE_ZONES.includes(name) ? CAR_BED_LABZONE : name
}

function addToSetMap(map: Map<string, Set<string>>, key: string, value: string | null) {
  if (!value) return
  if (!map.has(key)) map.set(key, new Set())
  map.get(key)!.add(value)
}

function countSetMap(map: Map<string, Set<string>>, key: string) {
  return map.get(key)?.size ?? 0
}

function collectSectionTests(
  matchers: ReturnType<typeof buildWorkloadMatchers>,
  sectionMonthTestRows: Map<string, number>
) {
  const testsBySection = new Map<string, WorkloadTestMeta[]>(
    Array.from(matchers.bySection.entries()).map(([section, tests]) => [section, [...tests]])
  )
  const seenBySection = new Map<string, Set<string>>(
    Array.from(testsBySection.entries()).map(([section, tests]) => [
      section,
      new Set(tests.map(test => test.test_name)),
    ])
  )

  for (const key of sectionMonthTestRows.keys()) {
    const parts = key.split('|')
    if (parts.length < 4) continue
    const section = parts[0]
    const testName = parts.slice(1, -2).join('|')
    if (!section || !testName) continue
    if (matchers.bySection.has(section)) continue

    if (!testsBySection.has(section)) testsBySection.set(section, [])
    if (!seenBySection.has(section)) seenBySection.set(section, new Set())

    const seen = seenBySection.get(section)!
    if (seen.has(testName)) continue
    seen.add(testName)
    testsBySection.get(section)!.push({
      section,
      test_name: testName,
      code: null,
      price: null,
    })
  }

  return testsBySection
}

function monthKey(year: number, month: number) {
  return `${year}-${month}`
}

function csvSafeKey(name: string | null) {
  return name?.trim() || 'ไม่ระบุ'
}

function normalizeLabSection(name: string | null) {
  const section = csvSafeKey(name)
  if (section === 'ธนาคารเลือดหมวด 6') return 'ธนาคารเลือด'
  if (section === 'อาชีวอนามัย') return 'เคมีคลินิก'
  return section
}

function normalizeMatchText(value: string | null) {
  return value
    ?.toLowerCase()
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[\/_,;:|+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() ?? ''
}

function parseNumber(value: unknown) {
  if (value == null || value === '') return null
  const n = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}

function readWorkloadWorkbook() {
  const filePath = path.resolve(process.cwd(), 'data', WORKLOAD_MAP_FILE)
  try {
    const buffer = fs.readFileSync(filePath)
    return XLSX.read(buffer, { type: 'buffer', cellDates: false })
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error'
    throw new Error(`Cannot access workload map file ${filePath}: ${reason}`)
  }
}

function readWorkloadTestMap(): WorkloadTestMeta[] {
  const wb = readWorkloadWorkbook()
  const rows: WorkloadTestMeta[] = []

  for (const section of wb.SheetNames) {
    const ws = wb.Sheets[section]
    const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: false, blankrows: false })
    for (const row of sheetRows.slice(2)) {
      const testName = String(row[1] ?? '').trim()
      if (!testName || testName === 'Test (LN)' || testName.toLowerCase() === 'total') continue
      const ephisCode = String(row[0] ?? '').trim()
      const govCode = String(row[2] ?? '').trim()
      rows.push({
        section,
        test_name: testName,
        code: ephisCode || govCode || null,
        price: parseNumber(row[3]),
      })
    }
  }

  rows.push(
    { section: 'อณูพันธุศาสตร์', test_name: 'NIPT (สปสช.)', code: null, price: null },
    { section: 'POCT2', test_name: 'POCT Blood gas', code: null, price: null },
    { section: 'POCT2', test_name: 'SARS-CoV-2(COVID-19) Rapid Antigen Test', code: null, price: null },
    { section: 'เคมีคลินิก', test_name: 'Protein-random urine', code: null, price: null }
  )

  return rows
}

function buildWorkloadMatchers(rows: WorkloadTestMeta[]) {
  const exact = new Map<string, WorkloadTestMeta[]>()
  const partial: { key: string; value: WorkloadTestMeta }[] = []
  const bySection = new Map<string, WorkloadTestMeta[]>()

  for (const row of rows) {
    const key = normalizeMatchText(row.test_name)
    if (!key) continue
    if (!exact.has(key)) exact.set(key, [])
    exact.get(key)!.push(row)
    if (!bySection.has(row.section)) bySection.set(row.section, [])
    bySection.get(row.section)!.push(row)
    if (key.length >= 4) partial.push({ key, value: row })
  }

  return { rows, exact, partial, bySection }
}

function getWorkloadMatchers() {
  if (!workloadMatchersCache) workloadMatchersCache = buildWorkloadMatchers(readWorkloadTestMap())
  return workloadMatchersCache
}

function pickPreferredMatch(matches: WorkloadTestMeta[], preferredSection: string | null) {
  if (matches.length === 0) return null
  if (preferredSection) {
    const preferred = matches.filter(match => match.section === preferredSection)
    if (preferred.length === 1) return preferred[0]
  }
  return matches.length === 1 ? matches[0] : null
}

function editDistance(a: string, b: string) {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  const curr = Array(b.length + 1).fill(0)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]
  }

  return prev[b.length]
}

function findFuzzySectionMatch(
  normalized: string,
  matchers: ReturnType<typeof buildWorkloadMatchers>,
  preferredSection: string | null
) {
  if (!preferredSection || normalized.length < 12) return null

  let best: { distance: number; row: WorkloadTestMeta } | null = null
  for (const row of matchers.bySection.get(preferredSection) ?? []) {
    const key = normalizeMatchText(row.test_name)
    if (!key || Math.abs(key.length - normalized.length) > 2) continue
    const distance = editDistance(normalized, key)
    if (distance <= 2 && (!best || distance < best.distance)) {
      best = { distance, row }
    }
  }

  return best?.row ?? null
}

function isHealthCenterWork(name: string | null) {
  return HEALTH_CENTER_RE.test(String(name ?? ''))
}

function isHealthCenterSection(section: string | null) {
  return HEALTH_CENTER_RE.test(String(section ?? ''))
}

function chemistryLikeSection(section: string | null) {
  if (isHealthCenterSection(section)) return HEALTH_CENTER_SECTION
  if (section === CHEMISTRY_SECTION) return CHEMISTRY_SECTION
  return null
}

function workloadRule(testName: string | null, preferredSection: string | null): WorkloadRule | null {
  const normalized = normalizeMatchText(testName)
  const isHealthCenter = isHealthCenterWork(testName)

  if (normalized === 'egfr ckd epi') return []
  if (normalized.startsWith('fio2')) return []
  if (normalized === 'tibc') return []
  if (normalized === 'protein random urine') {
    return [{ section: 'เคมีคลินิก', test_name: 'Protein-random urine' }]
  }
  if (normalized === 'microalbumin urine creatinine ratio') {
    return [{ section: 'ศสม.', test_name: 'Creatinine-random urine' }]
  }
  if (normalized === 'pregnancy test') {
    return [{
      section: isHealthCenter || isHealthCenterSection(preferredSection) ? HEALTH_CENTER_SECTION : 'จุลทรรศน์วิทยาคลินิก',
      test_name: 'Pregnancy test',
    }]
  }
  if (normalized === 'sars cov 2 covid 19 rapid antigen test') {
    return [{ section: 'POCT2', test_name: 'SARS-CoV-2(COVID-19) Rapid Antigen Test' }]
  }
  if (normalized === 'direct antiglobulin test gel method') {
    return [{ section: 'ธนาคารเลือด', test_name: 'DAT(Gel method)' }]
  }
  if (preferredSection === MOLECULAR_SECTION && normalized === 'cd34 stem cell enumeration pbsc') {
    return [{ section: MOLECULAR_SECTION, test_name: 'CD34 Stem cell enumeration(Peripheral blood)' }]
  }
  if (preferredSection === 'เคมีคลินิก' && normalized === 'iron study') {
    return [
      { section: 'เคมีคลินิก', test_name: 'Ferritin' },
      { section: 'เคมีคลินิก', test_name: 'Iron(Fe)' },
    ]
  }
  if (preferredSection === 'โลหิตวิทยา' && normalized === 'g 6 p d') {
    return [{ section: 'โลหิตวิทยา', test_name: 'G-6-PD' }]
  }
  if (preferredSection === 'โลหิตวิทยา' && normalized === 'pt inr') {
    return [{ section: 'โลหิตวิทยา', test_name: 'PT' }]
  }
  const chemistrySection = chemistryLikeSection(preferredSection)
  if (chemistrySection && normalized === 'lipid profile') {
    return [
      { section: chemistrySection, test_name: 'Cholesterol(total)' },
      { section: chemistrySection, test_name: 'HDL-Cholesterol' },
      { section: chemistrySection, test_name: 'Triglyceride' },
      { section: chemistrySection, test_name: 'LDL Cholesterol (direct)' },
    ]
  }
  if (chemistrySection && normalized === 'liver function') {
    return [
      { section: chemistrySection, test_name: 'SGOT(AST)' },
      { section: chemistrySection, test_name: 'SGPT(ALT)' },
      { section: chemistrySection, test_name: 'Alkaline phosphatase' },
    ]
  }
  if (chemistrySection && normalized === 'kidney function test clotted blood') {
    return [
      { section: chemistrySection, test_name: 'BUN(urea nitrogen)' },
      { section: chemistrySection, test_name: 'Creatinine' },
    ]
  }
  if (preferredSection === 'จุลชีววิทยา' && normalized === 'hemoculture 2 ขวด') {
    return [{ section: 'จุลชีววิทยา', test_name: 'Hemoculture ขวดที่1' }]
  }

  return null
}

function getRuleMeta(rule: WorkloadRule, matchers: ReturnType<typeof buildWorkloadMatchers>) {
  return rule
    .map(item => {
      const matches = matchers.exact.get(normalizeMatchText(item.test_name)) ?? []
      return matches.find(match => match.section === item.section)
        ?? matchers.bySection.get(item.section)?.find(match => match.test_name === item.test_name)
        ?? { ...item, code: null, price: null }
    })
}

function findWorkloadMatch(
  testName: string | null,
  matchers: ReturnType<typeof buildWorkloadMatchers>,
  preferredSection: string | null
) {
  const normalized = normalizeMatchText(testName)
  if (!normalized) return null

  const exact = pickPreferredMatch(matchers.exact.get(normalized) ?? [], preferredSection)
  if (exact) return exact

  const matches = matchers.partial
    .filter(({ key }) => normalized.includes(key) || key.includes(normalized))
    .map(({ value }) => value)

  return pickPreferredMatch(matches, preferredSection) ?? findFuzzySectionMatch(normalized, matchers, preferredSection)
}

function workloadMetasForTest(
  testName: string | null,
  matchers: ReturnType<typeof buildWorkloadMatchers>,
  preferredSection: string | null
) {
  const rule = workloadRule(testName, preferredSection)
  if (rule) return getRuleMeta(rule, matchers)

  const meta = findWorkloadMatch(testName, matchers, preferredSection)
  return meta ? [meta] : []
}

function toMatchedTatRows(row: TatRow, matchers: ReturnType<typeof buildWorkloadMatchers>): MatchedTatRow[] {
  const preferredSection = isHealthCenterWork(row.ward) || isHealthCenterWork(row.name_1) || isHealthCenterWork(row.test_name)
    ? HEALTH_CENTER_SECTION
    : normalizeLabSection(row.lab_section)

  return workloadMetasForTest(row.test_name, matchers, preferredSection)
    .map(meta => ({ ...row, ...meta }))
}

function buildDepartmentsFromMap(
  matchers: ReturnType<typeof buildWorkloadMatchers>,
  deptLn: Map<string, Set<string>>,
  deptRows: Map<string, number>
) {
  const sectionNames = new Set([
    ...matchers.bySection.keys(),
    ...deptLn.keys(),
    ...deptRows.keys(),
  ])

  return Array.from(sectionNames)
    .map((section) => ({
      section,
      ln_count: countSetMap(deptLn, section),
      test_rows: deptRows.get(section) ?? 0,
      test_count: matchers.bySection.get(section)?.length ?? 0,
    }))
    .sort((a, b) => b.ln_count - a.ln_count || a.section.localeCompare(b.section, 'th'))
}

function buildSectionDetailsFromMap(
  matchers: ReturnType<typeof buildWorkloadMatchers>,
  months: { year: number; month: number }[],
  selectedYear: number,
  selectedMonth: number,
  sectionMonthTestLn: Map<string, Set<string>>,
  sectionMonthTestInTimeLn: Map<string, Set<string>>,
  sectionMonthTestRows: Map<string, number>,
  sectionMonthTestInTimeRows: Map<string, number>
) {
  const testsBySection = collectSectionTests(matchers, sectionMonthTestRows)

  return Object.fromEntries(Array.from(testsBySection.entries()).map(([section, tests]) => {
    const rows = tests.map(test => {
      const monthsData: Record<string, MonthPair> = {}
      for (const ym of months) {
        const key = `${section}|${test.test_name}|${ym.year}|${ym.month}`
        monthsData[monthKey(ym.year, ym.month)] = {
          in_time: countSetMap(sectionMonthTestInTimeLn, key),
          total: countSetMap(sectionMonthTestLn, key),
          row_in_time: sectionMonthTestInTimeRows.get(key) ?? 0,
          row_total: sectionMonthTestRows.get(key) ?? 0,
        }
      }

      return {
        test_name: test.test_name,
        code: test.code,
        price: test.price,
        current_total: monthsData[monthKey(selectedYear, selectedMonth)]?.total ?? 0,
        current_test_rows: monthsData[monthKey(selectedYear, selectedMonth)]?.row_total ?? 0,
        fiscal_total: Object.values(monthsData).reduce((sum, m) => sum + m.total, 0),
        fiscal_test_rows: Object.values(monthsData).reduce((sum, m) => sum + m.row_total, 0),
        months: monthsData,
      }
    })

    return [section, rows]
  }))
}

function numeric(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function hasMeaningfulWorkloadPayload(payload: any) {
  const kpi = payload?.kpi ?? {}
  if (numeric(kpi.total_ln) > 0 || numeric(kpi.total_test_rows) > 0 || numeric(kpi.opd_hn) > 0) return true
  return Object.values(payload?.section_details ?? {}).some((rows: any) =>
    Array.isArray(rows) && rows.some(row => numeric(row.fiscal_total) > 0 || numeric(row.fiscal_test_rows) > 0)
  )
}

async function readLatestWorkloadCachePayload(year: number, month: number) {
  const { data, error } = await supabaseAdmin
    .from('analysis_summary_cache')
    .select('cache_key,payload')
    .eq('endpoint', CACHE_ENDPOINT)
    .eq('year', year)
    .eq('month', month)
    .gt('expires_at', new Date().toISOString())
    .like('cache_key', `${WORKLOAD_CACHE_VERSION}|%`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  const payload = data?.payload as any
  return hasMeaningfulWorkloadPayload(payload) ? payload : null
}

function cachedMonthPair(payload: any, section: string, testName: string, year: number, month: number): MonthPair | null {
  const row = (payload?.section_details?.[section] ?? []).find((item: any) => item.test_name === testName)
  const value = row?.months?.[monthKey(year, month)]
  if (!value) return null
  return {
    in_time: numeric(value.in_time),
    total: numeric(value.total),
    row_in_time: numeric(value.row_in_time),
    row_total: numeric(value.row_total),
  }
}

async function fetchPrecomputedRows(table: string, fiscalYear: number) {
  const rows: SummaryRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .eq('fiscal_year', fiscalYear)
      .range(from, from + PAGE_SIZE - 1)

    if (error) return { data: rows, error }
    rows.push(...((data ?? []) as SummaryRow[]))
    if (!data || data.length < PAGE_SIZE) break
  }

  return { data: rows, error: null }
}

function addSummaryCount(row: SummaryRow, field: string, value: unknown) {
  row[field] = numeric(row[field]) + numeric(value)
}

function mapPrecomputedTestRows(rows: SummaryRow[], matchers: ReturnType<typeof buildWorkloadMatchers>) {
  const merged = new Map<string, SummaryRow>()

  for (const row of rows) {
    const sourceSection = String(row.lab_section ?? '')
    const preferredSection = isHealthCenterSection(sourceSection)
      ? HEALTH_CENTER_SECTION
      : normalizeLabSection(sourceSection)
    const metas = workloadMetasForTest(String(row.test_name ?? ''), matchers, preferredSection)

    for (const meta of metas) {
      const key = [
        row.fiscal_year,
        row.year,
        row.month,
        meta.section,
        meta.test_name,
      ].join('|')
      const current = merged.get(key) ?? {
        fiscal_year: row.fiscal_year,
        year: row.year,
        month: row.month,
        lab_section: meta.section,
        test_name: meta.test_name,
        code: meta.code ?? row.code ?? null,
        price: meta.price ?? row.price ?? null,
        ln_count: 0,
        in_time_ln_count: 0,
        test_rows: 0,
        in_time_test_rows: 0,
      }

      addSummaryCount(current, 'ln_count', row.ln_count)
      addSummaryCount(current, 'in_time_ln_count', row.in_time_ln_count)
      addSummaryCount(current, 'test_rows', row.test_rows)
      addSummaryCount(current, 'in_time_test_rows', row.in_time_test_rows)
      if (!current.code && (meta.code ?? row.code)) current.code = meta.code ?? row.code
      if (current.price == null && (meta.price ?? row.price) != null) current.price = meta.price ?? row.price
      merged.set(key, current)
    }
  }

  return Array.from(merged.values())
}

async function fetchPrecomputedPayload(displayFiscalYear: number, fiscalYear: number, selectedYear: number, selectedMonth: number, months: { year: number; month: number }[]): Promise<Payload | null> {
  const [overallRes, deptRes, testRes, phlebRes, heatmaps, cachedPayloads] = await Promise.all([
    fetchPrecomputedRows('lab_workload_overall_monthly', fiscalYear),
    fetchPrecomputedRows('lab_workload_department_monthly', fiscalYear),
    fetchPrecomputedRows('lab_workload_test_monthly', fiscalYear),
    fetchPrecomputedRows('lab_workload_phleb_monthly', fiscalYear),
    fetchHeatmaps(selectedYear, selectedMonth),
    Promise.all(months.map(ym => readLatestWorkloadCachePayload(ym.year, ym.month))),
  ])

  const missingTable = [overallRes, deptRes, testRes, phlebRes].some(res => res.error?.code === '42P01')
  if (missingTable) return null
  const unexpectedError = [overallRes, deptRes, testRes, phlebRes].find(res => res.error)
  if (unexpectedError?.error) throw new Error(unexpectedError.error.message)
  const cacheByMonth = new Map(months.map((ym, index) => [monthKey(ym.year, ym.month), cachedPayloads[index]]))
  const hasPrecomputed = !!overallRes.data?.length || !!deptRes.data?.length || !!testRes.data?.length
  const hasCached = cachedPayloads.some(Boolean)
  if (!hasPrecomputed && !hasCached) return null

  const overallRows = overallRes.data ?? []
  const deptRows = deptRes.data ?? []
  const matchers = getWorkloadMatchers()
  const testRows = mapPrecomputedTestRows(testRes.data ?? [], matchers)
  const phlebRows = phlebRes.data ?? []
  const currentCache = cacheByMonth.get(monthKey(selectedYear, selectedMonth))
  const currentOverall = overallRows.find(row => row.year === selectedYear && row.month === selectedMonth)
  const precomputedCurrentDepartments: DepartmentSummary[] = deptRows
    .filter(row => row.year === selectedYear && row.month === selectedMonth)
    .map(row => ({
      section: row.lab_section as string,
      ln_count: Number(row.ln_count ?? 0),
      test_rows: Number(row.test_rows ?? 0),
      test_count: Number(row.test_count ?? 0),
    }))
  const cachedCurrentDepartments: DepartmentSummary[] = (currentCache?.departments ?? [])
    .map((row: any) => ({
      section: String(row.section ?? ''),
      ln_count: numeric(row.ln_count),
      test_rows: numeric(row.test_rows),
      test_count: numeric(row.test_count),
    }))
    .filter((row: DepartmentSummary) => row.section)
  const currentDepartments: DepartmentSummary[] = (precomputedCurrentDepartments.length > 0
    ? precomputedCurrentDepartments
    : cachedCurrentDepartments
  )
    .sort((a, b) => b.ln_count - a.ln_count)

  const fiscalSections = Array.from(new Set([
    ...testRows.map(row => row.lab_section as string).filter(Boolean),
    ...cachedPayloads.flatMap(payload => [
      ...(payload?.departments ?? []).map((row: any) => row.section),
      ...Object.keys(payload?.section_details ?? {}),
    ]).filter(Boolean),
  ]))
  const departments = [
    ...currentDepartments,
    ...fiscalSections
      .filter(section => !currentDepartments.some(dept => dept.section === section))
      .map(section => ({ section, ln_count: 0, test_rows: 0, test_count: 0 })),
  ]

  const trend = months.map(ym => {
    const row = overallRows.find(r => r.year === ym.year && r.month === ym.month)
    const cached = cacheByMonth.get(monthKey(ym.year, ym.month))
    return {
      year: ym.year,
      month: ym.month,
      ln_count: Number(row?.ln_count ?? cached?.kpi?.total_ln ?? 0),
      test_rows: Number(row?.test_rows ?? cached?.kpi?.total_test_rows ?? 0),
    }
  })

  const testGroups = new Map<string, SummaryRow[]>()
  for (const row of testRows) {
    const key = `${row.lab_section}|${row.test_name}`
    if (!testGroups.has(key)) testGroups.set(key, [])
    testGroups.get(key)!.push(row)
  }
  const testKeys = new Set(testGroups.keys())
  for (const payload of cachedPayloads) {
    for (const [section, rows] of Object.entries(payload?.section_details ?? {})) {
      for (const row of (Array.isArray(rows) ? rows : []) as any[]) {
        if (row.test_name) testKeys.add(`${section}|${row.test_name}`)
      }
    }
  }

  const sectionDetails: Record<string, unknown[]> = {}
  for (const dept of departments) {
    const rows = Array.from(testKeys)
      .filter((key) => key.startsWith(`${dept.section}|`))
      .map((key) => {
        const grouped = testGroups.get(key) ?? []
        const testName = key.slice(dept.section.length + 1)
        const monthsData: Record<string, MonthPair> = {}
        for (const ym of months) {
          const row = grouped.find(r => r.year === ym.year && r.month === ym.month)
          const cached = cachedMonthPair(cacheByMonth.get(monthKey(ym.year, ym.month)), dept.section, testName, ym.year, ym.month)
          monthsData[monthKey(ym.year, ym.month)] = row ? {
            in_time: Number(row?.in_time_ln_count ?? 0),
            total: Number(row?.ln_count ?? 0),
            row_in_time: Number(row?.in_time_test_rows ?? 0),
            row_total: Number(row?.test_rows ?? 0),
          } : (cached ?? { in_time: 0, total: 0, row_in_time: 0, row_total: 0 })
        }
        const selected = monthsData[monthKey(selectedYear, selectedMonth)]
        const fiscalTotal = Object.values(monthsData).reduce((sum, value) => sum + value.total, 0)
        const fiscalRows = Object.values(monthsData).reduce((sum, value) => sum + value.row_total, 0)
        return {
          test_name: testName,
          code: grouped.find(r => r.code)?.code ?? null,
          price: grouped.find(r => r.price != null)?.price ?? null,
          current_total: selected?.total ?? 0,
          current_test_rows: selected?.row_total ?? 0,
          fiscal_total: fiscalTotal,
          fiscal_test_rows: fiscalRows,
          months: monthsData,
        }
      })
      .filter(row => row.fiscal_total > 0 || row.fiscal_test_rows > 0)
      .sort((a, b) => b.current_total - a.current_total || b.current_test_rows - a.current_test_rows || b.fiscal_total - a.fiscal_total)
    sectionDetails[dept.section] = rows
  }

  const selectedPhlebRows = phlebRows.filter(r => r.year === selectedYear && r.month === selectedMonth)
  const phlebotomyZones = PHLEB_ALLOWED_LABZONES
    .map(labzone_name => {
      const row = selectedPhlebRows.find(r => r.labzone_name === labzone_name)
      const cached = (currentCache?.opd_rows ?? []).find((r: any) => r.labzone_name === labzone_name)
      return { labzone_name, hn_count: Number(row?.service_count ?? cached?.months?.[monthKey(selectedYear, selectedMonth)] ?? cached?.total ?? 0) }
    })
    .filter(row => row.hn_count > 0)
    .sort((a, b) => b.hn_count - a.hn_count)

  const opdRows = PHLEB_ALLOWED_LABZONES
    .map(labzone_name => {
      const values = Object.fromEntries(months.map(ym => {
        const row = phlebRows.find(r => r.year === ym.year && r.month === ym.month && r.labzone_name === labzone_name)
        const cached = (cacheByMonth.get(monthKey(ym.year, ym.month))?.opd_rows ?? []).find((r: any) => r.labzone_name === labzone_name)
        return [monthKey(ym.year, ym.month), Number(row?.service_count ?? cached?.months?.[monthKey(ym.year, ym.month)] ?? cached?.total ?? 0)]
      }))
      return {
        labzone_name,
        months: values,
        total: Object.values(values).reduce((sum, value) => sum + value, 0),
      }
    })
    .filter(row => row.total > 0)
    .sort((a, b) => b.total - a.total)

  return {
    fiscal_year: displayFiscalYear,
    selected_year: selectedYear,
    selected_month: selectedMonth,
    months,
    kpi: {
      total_ln: Number(currentOverall?.ln_count ?? currentCache?.kpi?.total_ln ?? 0),
      total_test_rows: Number(currentOverall?.test_rows ?? currentCache?.kpi?.total_test_rows ?? 0),
      department_count: currentDepartments.length,
      opd_hn: phlebotomyZones.reduce((sum, row) => sum + row.hn_count, 0),
    },
    departments,
    trend,
    heatmap: heatmaps.heatmap,
    phlebotomy_zones: phlebotomyZones,
    opd_rows: opdRows,
    phleb_heatmap: heatmaps.phleb_heatmap,
    section_details: sectionDetails,
    warnings: heatmaps.warnings,
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const displayFiscalYear = Number(req.nextUrl.searchParams.get('year'))
    const selectedMonth = Number(req.nextUrl.searchParams.get('month'))
    if (!displayFiscalYear || !Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) {
      return NextResponse.json({ error: 'year and month required' }, { status: 422 })
    }

    const fiscalYear = toGregorianYear(displayFiscalYear)
    const selectedYear = selectedMonth >= 10 ? fiscalYear - 1 : fiscalYear
    const uploadHealth = await fetchUploadHealth(selectedYear, selectedMonth)
    const key = `v26|${displayFiscalYear}|${fiscalYear}|${selectedYear}|${selectedMonth}|${uploadHealth.version}`
    const hit = cache.get(key)
    if (hit && hit.expiresAt > Date.now()) {
      return NextResponse.json(hit.payload, { headers: { 'X-Lab-Workload-Cache': 'hit' } })
    }

    const months = fiscalMonths(fiscalYear)
    const persistent = await readAnalysisCache<Payload>(CACHE_ENDPOINT, key)
    if (persistent && !hasMissingHeatmapWarning(persistent) && hasWorkloadMonthValues(persistent, selectedYear, selectedMonth)) {
      const heatmaps = await fetchHeatmaps(selectedYear, selectedMonth)
      const payload = applySelectedHeatmaps(persistent, heatmaps, uploadHealth.warnings, selectedYear, selectedMonth)
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload })
      return NextResponse.json(payload, { headers: { 'X-Lab-Workload-Cache': 'persistent' } })
    }

    const latestPersistent = await readLatestWorkloadPayload(selectedYear, selectedMonth)
    if (latestPersistent) {
      const heatmaps = await fetchHeatmaps(selectedYear, selectedMonth)
      const payload = applySelectedHeatmaps(latestPersistent, heatmaps, uploadHealth.warnings, selectedYear, selectedMonth)
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload })
      await writeAnalysisCache(CACHE_ENDPOINT, key, selectedYear, selectedMonth, payload, PERSISTENT_CACHE_TTL_MS)
      return NextResponse.json(payload, { headers: { 'X-Lab-Workload-Cache': 'latest-persistent' } })
    }

    if (req.nextUrl.searchParams.get('precomputed') === '1') {
      const precomputed = await fetchPrecomputedPayload(displayFiscalYear, fiscalYear, selectedYear, selectedMonth, months)
      if (precomputed) {
        precomputed.warnings = mergeWarnings(precomputed.warnings, uploadHealth.warnings)
        cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload: precomputed })
        if (!hasMissingHeatmapWarning(precomputed)) {
          await writeAnalysisCache(CACHE_ENDPOINT, key, selectedYear, selectedMonth, precomputed, PERSISTENT_CACHE_TTL_MS)
        }
        return NextResponse.json(precomputed, { headers: { 'X-Lab-Workload-Cache': 'precomputed' } })
      }
    }

    if (!uploadHealth.hasTatRecords && !uploadHealth.hasPhlebRecords) {
      const warnings = uploadHealth.warnings.length
        ? uploadHealth.warnings
        : ['ยังไม่มี records จริงสำหรับเดือนนี้ กรุณาอัปโหลดไฟล์ TAT/Phe ให้จบก่อน']
      const payload = emptyPayload(displayFiscalYear, selectedYear, selectedMonth, months, warnings)
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload })
      await writeAnalysisCache(CACHE_ENDPOINT, key, selectedYear, selectedMonth, payload, PERSISTENT_CACHE_TTL_MS)
      return NextResponse.json(payload, { headers: { 'X-Lab-Workload-Cache': 'empty' } })
    }

    if (req.nextUrl.searchParams.get('live') !== '1') {
      const payload = emptyPayload(displayFiscalYear, selectedYear, selectedMonth, months, [
        'ยังไม่มี rule-correct workload cache สำหรับเดือนนี้ กรุณา rebuild cache ก่อน ระบบจะไม่คำนวณ raw records ทั้งปีในหน้าเว็บเพื่อเลี่ยง statement timeout',
      ])
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload })
      return NextResponse.json(payload, { headers: { 'X-Lab-Workload-Cache': 'needs-cache' } })
    }

    const [tatRows, phlebRows, phlebRowsAll, heatmaps] = await Promise.all([
      fetchTatRows(months),
      fetchPhlebRows(selectedYear, selectedMonth),
      fetchPhlebRowsForMonths(months),
      fetchHeatmaps(selectedYear, selectedMonth),
    ])

  const matchers = getWorkloadMatchers()
  const matchedTatRows = tatRows
    .flatMap(row => toMatchedTatRows(row, matchers))
  const currentRows = matchedTatRows.filter(row => row.year === selectedYear && row.month === selectedMonth)
  const totalLn = new Set(currentRows.map(row => row.ln).filter(Boolean)).size

  const deptLn = new Map<string, Set<string>>()
  const deptRows = new Map<string, number>()
  const heatmapLn = new Map<string, Set<string>>()

  for (const row of currentRows) {
    const section = row.section
    deptRows.set(section, (deptRows.get(section) ?? 0) + 1)
    addToSetMap(deptLn, section, row.ln)

    if (row.spcm_dow != null && row.spcm_hour != null) {
      addToSetMap(heatmapLn, `${row.spcm_dow}-${row.spcm_hour}`, row.ln)
    }
  }

  const departments = buildDepartmentsFromMap(matchers, deptLn, deptRows)

  const trendLn = new Map<string, Set<string>>()
  const trendRows = new Map<string, number>()
  for (const row of matchedTatRows) {
    const key = monthKey(row.year, row.month)
    addToSetMap(trendLn, key, row.ln)
    trendRows.set(key, (trendRows.get(key) ?? 0) + 1)
  }

  const trend = months.map(ym => {
    const key = monthKey(ym.year, ym.month)
    return {
      year: ym.year,
      month: ym.month,
      ln_count: countSetMap(trendLn, key),
      test_rows: trendRows.get(key) ?? 0,
    }
  })

  const phlebZoneHn = new Map<string, Set<string>>()
  const phlebZoneVisits = new Map<string, number>()
  const phlebHeatmap = new Map<string, Set<string>>()
  let phlebAllowedVisits = 0
  for (const row of phlebRows) {
    const zone = normalizeLabzone(row.labzone_name)
    if (!zone || !PHLEB_ALLOWED_LABZONES.includes(zone)) continue
    phlebAllowedVisits += 1
    phlebZoneVisits.set(zone, (phlebZoneVisits.get(zone) ?? 0) + 1)
    addToSetMap(phlebZoneHn, zone, row.hn)

    if (row.register_at) {
      const d = new Date(row.register_at)
      addToSetMap(phlebHeatmap, `${d.getUTCDay()}-${d.getUTCHours()}`, row.hn)
    }
  }

  const phlebotomyZones = PHLEB_ALLOWED_LABZONES
    .map(labzone_name => ({ labzone_name, hn_count: phlebZoneVisits.get(labzone_name) ?? 0 }))
    .filter(row => row.hn_count > 0)
    .sort((a, b) => b.hn_count - a.hn_count)

  const opdZoneMonthVisits = new Map<string, number>()
  for (const row of phlebRowsAll) {
    const zone = normalizeLabzone(row.labzone_name)
    if (!zone || !PHLEB_ALLOWED_LABZONES.includes(zone)) continue
    const key = `${zone}|${row.year}|${row.month}`
    opdZoneMonthVisits.set(key, (opdZoneMonthVisits.get(key) ?? 0) + 1)
  }

  const opdRows = PHLEB_ALLOWED_LABZONES
    .map(labzone_name => {
      const monthValues = Object.fromEntries(months.map(ym => {
        const key = monthKey(ym.year, ym.month)
        return [key, opdZoneMonthVisits.get(`${labzone_name}|${ym.year}|${ym.month}`) ?? 0]
      }))
      return {
        labzone_name,
        months: monthValues,
        total: Object.values(monthValues).reduce((sum, value) => sum + value, 0),
      }
    })
    .filter(row => row.total > 0)
    .sort((a, b) => b.total - a.total)

  const sectionMonthTestLn = new Map<string, Set<string>>()
  const sectionMonthTestInTimeLn = new Map<string, Set<string>>()
  const sectionMonthTestRows = new Map<string, number>()
  const sectionMonthTestInTimeRows = new Map<string, number>()

  for (const row of matchedTatRows) {
    const section = row.section
    const test = row.test_name
    const key = `${section}|${test}|${row.year}|${row.month}`
    addToSetMap(sectionMonthTestLn, key, row.ln)
    if (row.within_target === true) addToSetMap(sectionMonthTestInTimeLn, key, row.ln)
    sectionMonthTestRows.set(key, (sectionMonthTestRows.get(key) ?? 0) + 1)
    if (row.within_target === true) {
      sectionMonthTestInTimeRows.set(key, (sectionMonthTestInTimeRows.get(key) ?? 0) + 1)
    }
  }

  const sectionDetails = buildSectionDetailsFromMap(
    matchers,
    months,
    selectedYear,
    selectedMonth,
    sectionMonthTestLn,
    sectionMonthTestInTimeLn,
    sectionMonthTestRows,
    sectionMonthTestInTimeRows
  )

  const liveHeatmap = Array.from(heatmapLn.entries()).map(([key, set]) => {
    const [dow, hour] = key.split('-').map(Number)
    return { dow, hour, count: set.size }
  })
  const livePhlebHeatmap = Array.from(phlebHeatmap.entries()).map(([key, set]) => {
    const [dow, hour] = key.split('-').map(Number)
    return { dow, hour, count: set.size }
  })

  const payload: Payload = {
    fiscal_year: displayFiscalYear,
    selected_year: selectedYear,
    selected_month: selectedMonth,
    months,
    kpi: {
      total_ln: totalLn,
      total_test_rows: currentRows.length,
      department_count: departments.length,
      opd_hn: phlebAllowedVisits,
    },
    departments,
    trend,
    heatmap: heatmaps.heatmap.length ? heatmaps.heatmap : liveHeatmap,
    phlebotomy_zones: phlebotomyZones,
    opd_rows: opdRows,
    phleb_heatmap: heatmaps.phleb_heatmap.length ? heatmaps.phleb_heatmap : livePhlebHeatmap,
    section_details: sectionDetails,
    warnings: mergeWarnings(uploadHealth.warnings, heatmaps.heatmap.length || heatmaps.phleb_heatmap.length ? [] : heatmaps.warnings),
  }

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload })
  await writeAnalysisCache(CACHE_ENDPOINT, key, selectedYear, selectedMonth, payload, PERSISTENT_CACHE_TTL_MS)
    return NextResponse.json(payload, { headers: { 'X-Lab-Workload-Cache': 'miss' } })
  } catch (err) {
    console.error('lab workload summary failed', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'โหลดข้อมูล workload ไม่สำเร็จ' }, { status: 500 })
  }
}
