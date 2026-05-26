import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { readAnalysisCache, writeAnalysisCache } from '@/lib/analysis-cache'
import { NextRequest, NextResponse } from 'next/server'

const PAGE_SIZE = 1000
const CACHE_TTL_MS = 3 * 60 * 1000
const PERSISTENT_CACHE_TTL_MS = 12 * 60 * 60 * 1000
const CACHE_ENDPOINT = 'lab-workload-summary'
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
  year: number
  month: number
  ln: string | null
  lab_section: string | null
  test_name: string | null
  within_target: boolean | null
  spcm_hour: number | null
  spcm_dow: number | null
}

interface PhlebRow {
  hn: string | null
  labzone_name: string | null
  register_at: string | null
}

interface TestCatalogRow {
  th: string | null
  en: string | null
  code: string | null
  lis_code: string | null
  price: number | null
}

type MonthPair = { in_time: number; total: number; row_in_time: number; row_total: number }
type Payload = Record<string, unknown>
type SummaryRow = Record<string, any>

const cache = new Map<string, { expiresAt: number; payload: Payload }>()

function toGregorianYear(year: number) {
  return year > 2400 ? year - 543 : year
}

function fiscalMonths(fiscalYear: number) {
  return [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(month => ({
    year: month >= 10 ? fiscalYear - 1 : fiscalYear,
    month,
  }))
}

async function fetchTatRows(months: { year: number; month: number }[]) {
  const rows: TatRow[] = []

  for (const ym of months) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabaseAdmin
        .from('tat_records')
        .select('year,month,ln,lab_section,test_name,within_target,spcm_hour,spcm_dow')
        .eq('year', ym.year)
        .eq('month', ym.month)
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(error.message)
      rows.push(...((data ?? []) as TatRow[]))
      if (!data || data.length < PAGE_SIZE) break
    }
  }

  return rows
}

async function fetchPhlebRows(year: number, month: number) {
  const rows: PhlebRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('phlebotomy_records')
      .select('hn,labzone_name,register_at')
      .eq('year', year)
      .eq('month', month)
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as PhlebRow[]))
    if (!data || data.length < PAGE_SIZE) break
  }

  return rows
}

async function fetchPhlebRowsForMonths(months: { year: number; month: number }[]) {
  const rows: (PhlebRow & { year: number; month: number })[] = []

  for (const ym of months) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabaseAdmin
        .from('phlebotomy_records')
        .select('year,month,hn,labzone_name,register_at')
        .eq('year', ym.year)
        .eq('month', ym.month)
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(error.message)
      rows.push(...((data ?? []) as (PhlebRow & { year: number; month: number })[]))
      if (!data || data.length < PAGE_SIZE) break
    }
  }

  return rows
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

function buildCatalogMap(rows: TestCatalogRow[]) {
  const map = new Map<string, { code: string | null; price: number | null }>()
  for (const row of rows) {
    const value = { code: row.code ?? row.lis_code ?? null, price: row.price }
    for (const key of [row.th, row.en, row.code, row.lis_code]) {
      const trimmed = key?.trim()
      if (trimmed && !map.has(trimmed)) map.set(trimmed, value)
    }
  }
  return map
}

async function fetchPrecomputedPayload(displayFiscalYear: number, fiscalYear: number, selectedYear: number, selectedMonth: number, months: { year: number; month: number }[]) {
  const [overallRes, deptRes, testRes, phlebRes] = await Promise.all([
    supabaseAdmin.from('lab_workload_overall_monthly').select('*').eq('fiscal_year', fiscalYear),
    supabaseAdmin.from('lab_workload_department_monthly').select('*').eq('fiscal_year', fiscalYear),
    supabaseAdmin.from('lab_workload_test_monthly').select('*').eq('fiscal_year', fiscalYear),
    supabaseAdmin.from('lab_workload_phleb_monthly').select('*').eq('fiscal_year', fiscalYear),
  ])

  const missingTable = [overallRes, deptRes, testRes, phlebRes].some(res => res.error?.code === '42P01')
  if (missingTable) return null
  const unexpectedError = [overallRes, deptRes, testRes, phlebRes].find(res => res.error)
  if (unexpectedError?.error) throw new Error(unexpectedError.error.message)
  if (!overallRes.data?.length || !deptRes.data?.length || !testRes.data?.length) return null

  const currentOverall = (overallRes.data as SummaryRow[]).find(row => row.year === selectedYear && row.month === selectedMonth)
  const departments = (deptRes.data as SummaryRow[])
    .filter(row => row.year === selectedYear && row.month === selectedMonth)
    .map(row => ({
      section: row.lab_section as string,
      ln_count: Number(row.ln_count ?? 0),
      test_rows: Number(row.test_rows ?? 0),
      test_count: Number(row.test_count ?? 0),
    }))
    .sort((a, b) => b.ln_count - a.ln_count)

  const trend = months.map(ym => {
    const row = (overallRes.data as SummaryRow[]).find(r => r.year === ym.year && r.month === ym.month)
    return {
      year: ym.year,
      month: ym.month,
      ln_count: Number(row?.ln_count ?? 0),
      test_rows: Number(row?.test_rows ?? 0),
    }
  })

  const testGroups = new Map<string, SummaryRow[]>()
  for (const row of (testRes.data ?? []) as SummaryRow[]) {
    const key = `${row.lab_section}|${row.test_name}`
    if (!testGroups.has(key)) testGroups.set(key, [])
    testGroups.get(key)!.push(row)
  }

  const sectionDetails: Record<string, unknown[]> = {}
  for (const dept of departments) {
    const rows = Array.from(testGroups.entries())
      .filter(([key]) => key.startsWith(`${dept.section}|`))
      .map(([key, grouped]) => {
        const testName = key.slice(dept.section.length + 1)
        const monthsData: Record<string, MonthPair> = {}
        for (const ym of months) {
          const row = grouped.find(r => r.year === ym.year && r.month === ym.month)
          monthsData[monthKey(ym.year, ym.month)] = {
            in_time: Number(row?.in_time_ln_count ?? 0),
            total: Number(row?.ln_count ?? 0),
            row_in_time: Number(row?.in_time_test_rows ?? 0),
            row_total: Number(row?.test_rows ?? 0),
          }
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

  const phlebRows = (phlebRes.data as SummaryRow[])
  const phlebotomyZones = PHLEB_ALLOWED_LABZONES
    .map(labzone_name => {
      const row = phlebRows.find(r => r.year === selectedYear && r.month === selectedMonth && r.labzone_name === labzone_name)
      return { labzone_name, hn_count: Number(row?.service_count ?? 0) }
    })
    .filter(row => row.hn_count > 0)
    .sort((a, b) => b.hn_count - a.hn_count)

  const opdRows = PHLEB_ALLOWED_LABZONES
    .map(labzone_name => {
      const values = Object.fromEntries(months.map(ym => {
        const row = phlebRows.find(r => r.year === ym.year && r.month === ym.month && r.labzone_name === labzone_name)
        return [monthKey(ym.year, ym.month), Number(row?.service_count ?? 0)]
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
      total_ln: Number(currentOverall?.ln_count ?? 0),
      total_test_rows: Number(currentOverall?.test_rows ?? 0),
      department_count: departments.length,
      opd_hn: phlebotomyZones.reduce((sum, row) => sum + row.hn_count, 0),
    },
    departments,
    trend,
    phlebotomy_zones: phlebotomyZones,
    opd_rows: opdRows,
    section_details: sectionDetails,
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const displayFiscalYear = Number(req.nextUrl.searchParams.get('year'))
  const selectedMonth = Number(req.nextUrl.searchParams.get('month'))
  if (!displayFiscalYear || !selectedMonth) {
    return NextResponse.json({ error: 'year and month required' }, { status: 422 })
  }

  const fiscalYear = toGregorianYear(displayFiscalYear)
  const selectedYear = selectedMonth >= 10 ? fiscalYear - 1 : fiscalYear
  const key = `v2|${displayFiscalYear}|${fiscalYear}|${selectedYear}|${selectedMonth}`
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json(hit.payload, { headers: { 'X-Lab-Workload-Cache': 'hit' } })
  }

  const months = fiscalMonths(fiscalYear)
  const persistent = await readAnalysisCache<Payload>(CACHE_ENDPOINT, key)
  if (persistent) {
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload: persistent })
    return NextResponse.json(persistent, { headers: { 'X-Lab-Workload-Cache': 'persistent' } })
  }

  const precomputed = await fetchPrecomputedPayload(displayFiscalYear, fiscalYear, selectedYear, selectedMonth, months)
  if (precomputed) {
    const [selectedTatRows, selectedPhlebRows] = await Promise.all([
      fetchTatRows([{ year: selectedYear, month: selectedMonth }]),
      fetchPhlebRows(selectedYear, selectedMonth),
    ])
    const heatmapLn = new Map<string, Set<string>>()
    for (const row of selectedTatRows) {
      if (row.spcm_dow != null && row.spcm_hour != null) {
        addToSetMap(heatmapLn, `${row.spcm_dow}-${row.spcm_hour}`, row.ln)
      }
    }

    const phlebHeatmap = new Map<string, Set<string>>()
    for (const row of selectedPhlebRows) {
      const zone = normalizeLabzone(row.labzone_name)
      if (!zone || !PHLEB_ALLOWED_LABZONES.includes(zone) || !row.register_at) continue
      const d = new Date(row.register_at)
      addToSetMap(phlebHeatmap, `${d.getUTCDay()}-${d.getUTCHours()}`, row.hn)
    }

    const payload = {
      ...precomputed,
      heatmap: Array.from(heatmapLn.entries()).map(([key, set]) => {
        const [dow, hour] = key.split('-').map(Number)
        return { dow, hour, count: set.size }
      }),
      phleb_heatmap: Array.from(phlebHeatmap.entries()).map(([key, set]) => {
        const [dow, hour] = key.split('-').map(Number)
        return { dow, hour, count: set.size }
      }),
    }
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload })
    await writeAnalysisCache(CACHE_ENDPOINT, key, selectedYear, selectedMonth, payload, PERSISTENT_CACHE_TTL_MS)
    return NextResponse.json(payload, { headers: { 'X-Lab-Workload-Cache': 'precomputed' } })
  }

  const [{ data: catalogRows, error: catalogError }, tatRows, phlebRows, phlebRowsAll] = await Promise.all([
    supabaseAdmin.from('tests').select('th,en,code,lis_code,price'),
    fetchTatRows(months),
    fetchPhlebRows(selectedYear, selectedMonth),
    fetchPhlebRowsForMonths(months),
  ])
  if (catalogError) return NextResponse.json({ error: catalogError.message }, { status: 500 })

  const catalog = buildCatalogMap((catalogRows ?? []) as TestCatalogRow[])
  const currentRows = tatRows.filter(row => row.year === selectedYear && row.month === selectedMonth)
  const totalLn = new Set(currentRows.map(row => row.ln).filter(Boolean)).size

  const deptLn = new Map<string, Set<string>>()
  const deptRows = new Map<string, number>()
  const deptTests = new Map<string, Set<string>>()
  const heatmapLn = new Map<string, Set<string>>()

  for (const row of currentRows) {
    const section = normalizeLabSection(row.lab_section)
    const test = csvSafeKey(row.test_name)
    deptRows.set(section, (deptRows.get(section) ?? 0) + 1)
    addToSetMap(deptLn, section, row.ln)
    if (!deptTests.has(section)) deptTests.set(section, new Set())
    deptTests.get(section)!.add(test)

    if (row.spcm_dow != null && row.spcm_hour != null) {
      addToSetMap(heatmapLn, `${row.spcm_dow}-${row.spcm_hour}`, row.ln)
    }
  }

  const departments = Array.from(deptRows.keys())
    .map(section => ({
      section,
      ln_count: countSetMap(deptLn, section),
      test_rows: deptRows.get(section) ?? 0,
      test_count: deptTests.get(section)?.size ?? 0,
    }))
    .sort((a, b) => b.ln_count - a.ln_count)

  const trendLn = new Map<string, Set<string>>()
  const trendRows = new Map<string, number>()
  for (const row of tatRows) {
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

  for (const row of tatRows) {
    const section = normalizeLabSection(row.lab_section)
    const test = csvSafeKey(row.test_name)
    const key = `${section}|${test}|${row.year}|${row.month}`
    addToSetMap(sectionMonthTestLn, key, row.ln)
    if (row.within_target === true) addToSetMap(sectionMonthTestInTimeLn, key, row.ln)
    sectionMonthTestRows.set(key, (sectionMonthTestRows.get(key) ?? 0) + 1)
    if (row.within_target === true) {
      sectionMonthTestInTimeRows.set(key, (sectionMonthTestInTimeRows.get(key) ?? 0) + 1)
    }
  }

  const sectionDetails = Object.fromEntries(departments.map(dept => {
    const tests = Array.from(deptTests.get(dept.section) ?? [])
      .map(testName => {
        const meta = catalog.get(testName)
        const monthsData: Record<string, MonthPair> = {}
        for (const ym of months) {
          const key = `${dept.section}|${testName}|${ym.year}|${ym.month}`
          monthsData[monthKey(ym.year, ym.month)] = {
            in_time: countSetMap(sectionMonthTestInTimeLn, key),
            total: countSetMap(sectionMonthTestLn, key),
            row_in_time: sectionMonthTestInTimeRows.get(key) ?? 0,
            row_total: sectionMonthTestRows.get(key) ?? 0,
          }
        }
        return {
          test_name: testName,
          code: meta?.code ?? null,
          price: meta?.price ?? null,
          current_total: monthsData[monthKey(selectedYear, selectedMonth)]?.total ?? 0,
          current_test_rows: monthsData[monthKey(selectedYear, selectedMonth)]?.row_total ?? 0,
          fiscal_total: Object.values(monthsData).reduce((sum, m) => sum + m.total, 0),
          fiscal_test_rows: Object.values(monthsData).reduce((sum, m) => sum + m.row_total, 0),
          months: monthsData,
        }
      })
      .filter(row => row.fiscal_total > 0 || row.fiscal_test_rows > 0)
      .sort((a, b) => b.current_total - a.current_total || b.current_test_rows - a.current_test_rows || b.fiscal_total - a.fiscal_total)

    return [dept.section, tests]
  }))

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
    heatmap: Array.from(heatmapLn.entries()).map(([key, set]) => {
      const [dow, hour] = key.split('-').map(Number)
      return { dow, hour, count: set.size }
    }),
    phlebotomy_zones: phlebotomyZones,
    opd_rows: opdRows,
    phleb_heatmap: Array.from(phlebHeatmap.entries()).map(([key, set]) => {
      const [dow, hour] = key.split('-').map(Number)
      return { dow, hour, count: set.size }
    }),
    section_details: sectionDetails,
  }

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload })
  await writeAnalysisCache(CACHE_ENDPOINT, key, selectedYear, selectedMonth, payload, PERSISTENT_CACHE_TTL_MS)
  return NextResponse.json(payload, { headers: { 'X-Lab-Workload-Cache': 'miss' } })
}
