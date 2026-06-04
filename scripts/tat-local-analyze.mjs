#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { TextDecoder } from 'node:util'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

dotenv.config({ path: '.env.local' })
dotenv.config()

const CACHE_ENDPOINT = 'tat-summary'
const CACHE_VERSION = 'v2'
const CACHE_TTL_DAYS = 365
const WORKLOAD_CACHE_ENDPOINT = 'lab-workload-summary'
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
const URGENT_PRIORITY = 'ด่วน'

const STAGES = {
  wait: 'รอเจาะเลือด',
  draw: 'เจาะเลือด',
  transport: 'ขนส่งตัวอย่าง',
  lab: 'วิเคราะห์ในแลป',
}

const BINS = [
  { label: '<30นาที', max: 30 },
  { label: '30-60นาที', max: 60 },
  { label: '1-2ชม.', max: 120 },
  { label: '2-4ชม.', max: 240 },
  { label: '4-8ชม.', max: 480 },
  { label: '>8ชม.', max: Infinity },
]

const BLOOD_TUBE_KEYWORDS = [
  'edta', 'sst', 'plain', 'clot', 'citrate', 'heparin',
  'sodium citrate', 'lithium', 'serum', 'k2', 'k3', 'gel',
  'purple', 'lavender', 'red', 'gold', 'green', 'blue', 'grey', 'gray',
]
const NON_BLOOD_TUBE_KEYWORDS = [
  'urine', 'ปัสสาวะ', 'stool', 'อุจจาระ', 'feces', 'swab', 'สวอบ',
  'sputum', 'เสมหะ', 'csf', 'น้ำไขสันหลัง', 'fluid', 'ของเหลว',
  'semen', 'น้ำอสุจิ', 'tissue', 'ชิ้นเนื้อ', 'aspirate', 'nasal', 'nasopharyngeal',
]

function usage() {
  console.log(`
Usage:
  npm run tat:local -- --tat "TAT 0469.txt" --phleb "phe 0469.txt"
  npm run tat:local -- --from-db --year 2026 --month 4

Optional:
  --year 2026 --month 4

Note:
  This script publishes analysis cache only. It does not create upload history
  or import rows into tat_records/phlebotomy_records.

Environment:
  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`)
}

function args() {
  const out = {}
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i]
    if (!key.startsWith('--')) continue
    const next = process.argv[i + 1]
    if (!next || next.startsWith('--')) {
      out[key.slice(2)] = true
    } else {
      out[key.slice(2)] = next
      i += 1
    }
  }
  return out
}

function normalizeHn(hn) {
  if (!hn) return ''
  return /^\d+$/.test(hn) ? String(parseInt(hn, 10)) : hn
}

function normalizeHeader(s) {
  return String(s || '').trim().toLowerCase().replace(/[\s_\-]/g, '')
}

function col(cols, headers, names, fallbackIndex) {
  for (const name of names) {
    const idx = headers.indexOf(normalizeHeader(name))
    if (idx >= 0) return cols[idx]
  }
  return fallbackIndex === undefined ? undefined : cols[fallbackIndex]
}

function parseTatThaiDT(s) {
  if (!s) return null
  const m = s.trim().match(/(\d+)\/(\d+)\/(\d+) - (\d+):(\d+):(\d+)/)
  if (!m) return null
  const [, d, mo, y, h, min, sec] = m
  return new Date(Date.UTC(+y - 543, +mo - 1, +d, +h, +min, +sec)).toISOString()
}

function parsePhlebThaiDT(s) {
  if (!s) return null
  const m = s.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const [, d, mo, y, h, min, sec] = m
  const ceYear = +y - 543
  if (ceYear < 2000 || ceYear > 2100) return null
  return new Date(Date.UTC(ceYear, +mo - 1, +d, +h, +min, +sec)).toISOString()
}

function readUtf16Lines(file) {
  const text = new TextDecoder('utf-16le').decode(fs.readFileSync(file))
  return text.replace(/^\uFEFF/, '').split(/\r?\n/)
}

function parseTatFile(file) {
  const lines = readUtf16Lines(file)
  const headers = lines[0].split('\t').map(normalizeHeader)
  const rows = []
  let invalid = 0

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cols = lines[i].split('\t')
    const register = parseTatThaiDT(col(cols, headers, ['lvstdatetime'], undefined))
    const spcm = parseTatThaiDT(col(cols, headers, ['spcmdatetime', 'spcmdatee'], 8))
    const rslt = parseTatThaiDT(col(cols, headers, ['rsltdatetime', 'rsltdatee'], 9))
    if (!spcm || !rslt) { invalid += 1; continue }
    const tat = (new Date(rslt) - new Date(spcm)) / 60000
    if (tat < 0 || tat > 10080) { invalid += 1; continue }
    const spcmDate = new Date(spcm)
    rows.push({
      hn: normalizeHn(col(cols, headers, ['hn'], 3)?.trim() || ''),
      ln: col(cols, headers, ['ln'], 5)?.trim() || '',
      register_at: register,
      spcm_at: spcm,
      rslt_at: rslt,
      tat_minutes: Math.round(tat * 10) / 10,
      lab_section: col(cols, headers, ['labsection', 'section'], 2)?.trim() || '',
      name_1: col(cols, headers, ['name1', 'name_1'], undefined)?.trim() || '',
      ward: col(cols, headers, ['ward'], 14)?.trim() || '',
      priority: col(cols, headers, ['priority'], 15)?.trim() || '',
      test_name: col(cols, headers, ['testname', 'test_name'], 13)?.trim() || '',
      spcm_hour: spcmDate.getUTCHours(),
      spcm_dow: spcmDate.getUTCDay(),
    })
  }
  return { rows, invalid }
}

function parsePhlebFile(file) {
  const lines = readUtf16Lines(file)
  const rows = []
  let invalid = 0

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cols = lines[i].split('\t')
    const queueConfirmedAt = parsePhlebThaiDT(cols[3])
    const phlebDone = parsePhlebThaiDT(cols[4])
    if (!queueConfirmedAt || !phlebDone) { invalid += 1; continue }
    const draw = (new Date(phlebDone) - new Date(queueConfirmedAt)) / 60000
    const hn = normalizeHn(cols[0]?.trim() || '')
    if (!hn || draw < 0 || draw > 480) { invalid += 1; continue }
    rows.push({
      hn,
      register_at: queueConfirmedAt,
      queue_confirmed_at: queueConfirmedAt,
      phleb_done_at: phlebDone,
      wait_minutes: Math.round(draw * 100) / 100,
      draw_minutes: Math.round(draw * 100) / 100,
      labzone_name: cols[13]?.trim() || null,
      phlebotomist: cols[15]?.trim() || null,
      phleb_date: queueConfirmedAt.slice(0, 10),
    })
  }
  return { rows, invalid }
}

function parseTatTargetMinutes(value) {
  if (!value) return null
  const raw = String(value).trim()
  const nums = raw.match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) ?? []
  if (!nums.length) return null
  const n = Math.max(...nums)
  const normalized = raw.toLowerCase().replace(/\s+/g, '')
  if (normalized.includes('นาที')) return n
  if (normalized.includes('ชม') || normalized.includes('ช.ม') || normalized.includes('ชั่วโมง') || normalized.includes('hr') || normalized.includes('hour')) return n * 60
  if (normalized.includes('วัน')) return n * 24 * 60
  return n
}

function classifyTube(tube) {
  if (!tube) return 'unknown'
  const t = String(tube).toLowerCase()
  if (NON_BLOOD_TUBE_KEYWORDS.some(k => t.includes(k))) return 'non_blood'
  if (BLOOD_TUBE_KEYWORDS.some(k => t.includes(k))) return 'blood'
  return 'unknown'
}

function isBloodDrawTube(tube) {
  return classifyTube(tube) === 'blood'
}

async function fetchTestMaps(supabase) {
  const { data, error } = await supabase
    .from('tests')
    .select('th,en,code,lis_code,tat,tat_minutes,urgent_tat_minutes,tube')
  if (error) throw new Error(error.message)

  const targetMap = new Map()
  const urgentTargetMap = new Map()
  const tubeMap = new Map()

  for (const r of data ?? []) {
    const keys = [r.th, r.en, r.code, r.lis_code].filter(Boolean).map(v => String(v).trim()).filter(Boolean)
    for (const key of keys) {
      const normalTat = r.tat_minutes ?? r.tat
      if (normalTat && !targetMap.has(key)) {
        const v = parseTatTargetMinutes(normalTat)
        if (v !== null) targetMap.set(key, v)
      }
      if (r.urgent_tat_minutes && !urgentTargetMap.has(key)) {
        const v = parseTatTargetMinutes(r.urgent_tat_minutes)
        if (v !== null) urgentTargetMap.set(key, v)
      }
      if (r.tube && !tubeMap.has(key)) tubeMap.set(key, r.tube)
    }
  }

  return { targetMap, urgentTargetMap, tubeMap }
}

function resolveTarget(testName, map) {
  const values = String(testName ?? '')
    .split(',')
    .map(t => map.get(t.trim()))
    .filter(v => v !== undefined)
  return values.length ? Math.max(...values) : null
}

function isPanelBloodDraw(testName, tubeMap) {
  return String(testName ?? '')
    .split(',')
    .map(t => tubeMap.get(t.trim()) ?? null)
    .some(isBloodDrawTube)
}

function splitTatRows(tatRows, maps) {
  const records = []
  for (const row of tatRows) {
    const tests = row.test_name.split(',').map(t => t.trim()).filter(Boolean)
    const effectiveTests = tests.length ? tests : [row.test_name]
    for (const testName of effectiveTests) {
      const target = row.priority === URGENT_PRIORITY
        ? (resolveTarget(testName, maps.urgentTargetMap) ?? resolveTarget(testName, maps.targetMap) ?? 30)
        : resolveTarget(testName, maps.targetMap)
      records.push({
        ...row,
        test_name: testName,
        target_minutes: target,
        within_target: target !== null ? row.tat_minutes <= target : null,
        is_blood_draw: isPanelBloodDraw(testName, maps.tubeMap),
        match_confidence: 'no_match',
      })
    }
  }

  const seenKeys = new Set()
  return records.filter(r => {
    const key = `${r.ln ?? ''}|${r.hn ?? ''}|${r.spcm_at}|${r.test_name}|${r.lab_section}`
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })
}

function toMs(value) {
  return value ? new Date(value).getTime() : Number.NaN
}

function minutes(endMs, startMs) {
  return Number(((endMs - startMs) / 60000).toFixed(6))
}

function lowerBound(rows, targetMs) {
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((rows[mid]._done ?? 0) < targetMs) lo = mid + 1
    else hi = mid
  }
  return lo
}

function findNearestPhleb(rows, spcmMs) {
  const minMs = spcmMs - 480 * 60000
  const maxMs = spcmMs + 120 * 60000
  const idx = lowerBound(rows, spcmMs)
  let best = null
  let bestAbs = Number.POSITIVE_INFINITY

  const consider = row => {
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
  for (let i = idx - 2; i >= 0 && (rows[i]._done ?? 0) >= minMs; i--) consider(rows[i])
  for (let i = idx + 2; i < rows.length && (rows[i]._done ?? 0) <= maxMs; i++) consider(rows[i])
  return best
}

function joinPhleb(tatRecords, phlebRows) {
  const byHn = new Map()
  const duplicateVisit = new Map()
  for (const row of phlebRows) {
    row._done = toMs(row.phleb_done_at)
    if (!row.hn || !Number.isFinite(row._done)) continue
    if (!byHn.has(row.hn)) byHn.set(row.hn, [])
    byHn.get(row.hn).push(row)
    const key = `${row.hn}|${row.phleb_date ?? ''}`
    duplicateVisit.set(key, (duplicateVisit.get(key) ?? 0) + 1)
  }
  for (const rows of byHn.values()) rows.sort((a, b) => a._done - b._done)

  for (const tat of tatRecords) {
    if (!tat.is_blood_draw) continue
    const spcmMs = toMs(tat.spcm_at)
    const phleb = tat.hn && Number.isFinite(spcmMs) ? findNearestPhleb(byHn.get(tat.hn) ?? [], spcmMs) : null
    if (!phleb) continue
    const registerMs = toMs(tat.register_at)
    const queueMs = toMs(phleb.queue_confirmed_at ?? phleb.register_at)
    const resultMs = toMs(tat.rslt_at)
    tat.queue_confirmed_at = phleb.queue_confirmed_at ?? phleb.register_at
    tat.phleb_done_at = phleb.phleb_done_at
    tat.phleb_wait_minutes = Number.isFinite(registerMs) && Number.isFinite(queueMs) ? minutes(queueMs, registerMs) : null
    tat.phleb_draw_minutes = phleb.draw_minutes ?? phleb.wait_minutes
    tat.transport_minutes = minutes(spcmMs, phleb._done)
    tat.total_tat_minutes = Number.isFinite(resultMs) && Number.isFinite(registerMs) ? minutes(resultMs, registerMs) : null
    tat.labzone_name = phleb.labzone_name
    tat.phlebotomist = phleb.phlebotomist
    tat.match_confidence = (duplicateVisit.get(`${phleb.hn}|${phleb.phleb_date ?? ''}`) ?? 1) > 1 ? 'ambiguous' : 'exact'
  }
}

function avg(values) {
  const nums = values.filter(Number.isFinite)
  return nums.length ? Number((nums.reduce((s, v) => s + v, 0) / nums.length).toFixed(1)) : 0
}

function median(values) {
  const nums = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!nums.length) return 0
  const mid = Math.floor(nums.length / 2)
  return Number((nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2).toFixed(1))
}

function pct(part, total, digits = 1) {
  return total ? Number(((part * 100) / total).toFixed(digits)) : 0
}

function unique(arr) {
  return Array.from(new Set(arr.filter(v => v != null && String(v).trim() !== '').map(v => String(v)))).sort((a, b) => a.localeCompare(b, 'th'))
}

function fiscalDisplayYear(year, month) {
  return (month >= 10 ? year + 1 : year) + 543
}

function fiscalMonths(fiscalYear) {
  return [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(m => ({
    year: m >= 10 ? fiscalYear - 1 : fiscalYear,
    month: m,
  }))
}

function rollingMonths(year, month, count) {
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(Date.UTC(year, month - 1 - (count - 1 - index), 1))
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
  })
}

function monthKey(year, month) {
  return `${year}-${month}`
}

function groupCount(rows, keyFn) {
  const map = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (key == null || key === '') continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

function addToSetMap(map, key, value) {
  if (!value) return
  if (!map.has(key)) map.set(key, new Set())
  map.get(key).add(value)
}

function countSetMap(map, key) {
  return map.get(key)?.size ?? 0
}

function collectSectionTests(matchers, matchedRows) {
  const testsBySection = new Map(
    Array.from(matchers.bySection.entries()).map(([section, tests]) => [section, [...tests]])
  )
  const seenBySection = new Map(
    Array.from(testsBySection.entries()).map(([section, tests]) => [
      section,
      new Set(tests.map(test => test.test_name)),
    ])
  )

  for (const row of matchedRows) {
    if (!row.section || !row.test_name) continue
    if (matchers.bySection.has(row.section)) continue
    if (!testsBySection.has(row.section)) testsBySection.set(row.section, [])
    if (!seenBySection.has(row.section)) seenBySection.set(row.section, new Set())

    const seen = seenBySection.get(row.section)
    if (seen.has(row.test_name)) continue
    seen.add(row.test_name)
    testsBySection.get(row.section).push({
      section: row.section,
      test_name: row.test_name,
      code: row.code ?? null,
      price: row.price ?? null,
    })
  }

  return testsBySection
}

function buildHeatmap(rows, dateField, uniqueField = null) {
  const map = new Map()
  for (const row of rows) {
    if (!row[dateField]) continue
    const d = new Date(row[dateField])
    const key = `${d.getUTCDay()}-${d.getUTCHours()}`
    if (uniqueField) {
      if (!map.has(key)) map.set(key, new Set())
      const v = row[uniqueField]
      if (v) map.get(key).add(v)
    } else {
      map.set(key, (map.get(key) ?? 0) + 1)
    }
  }
  return Array.from(map.entries()).map(([key, value]) => {
    const [dow, hour] = key.split('-').map(Number)
    return { dow, hour, count: value instanceof Set ? value.size : value }
  })
}

function normalizeMatchText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[\/_,;:|+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseNumber(value) {
  if (value == null || value === '') return null
  const n = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}

function readWorkloadTestMap() {
  const filePath = path.resolve(process.cwd(), 'data', WORKLOAD_MAP_FILE)
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: false })
  const rows = []

  for (const section of wb.SheetNames) {
    const ws = wb.Sheets[section]
    const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false, blankrows: false })
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

function buildWorkloadMatchers(rows) {
  const exact = new Map()
  const partial = []
  const bySection = new Map()

  for (const row of rows) {
    const key = normalizeMatchText(row.test_name)
    if (!key) continue
    if (!exact.has(key)) exact.set(key, [])
    exact.get(key).push(row)
    if (!bySection.has(row.section)) bySection.set(row.section, [])
    bySection.get(row.section).push(row)
    if (key.length >= 4) partial.push({ key, value: row })
  }

  return { rows, exact, partial, bySection }
}

function csvSafeKey(name) {
  return String(name ?? '').trim() || 'ไม่ระบุ'
}

function normalizeLabSection(name) {
  const section = csvSafeKey(name)
  if (section === 'ธนาคารเลือดหมวด 6') return 'ธนาคารเลือด'
  if (section === 'อาชีวอนามัย') return 'เคมีคลินิก'
  return section
}

function normalizeLabzone(name) {
  const zone = String(name ?? '').trim()
  if (!zone) return null
  return CAR_BED_SOURCE_ZONES.includes(zone) ? CAR_BED_LABZONE : zone
}

function pickPreferredMatch(matches, preferredSection) {
  if (!matches.length) return null
  if (preferredSection) {
    const preferred = matches.filter(match => match.section === preferredSection)
    if (preferred.length === 1) return preferred[0]
  }
  return matches.length === 1 ? matches[0] : null
}

function editDistance(a, b) {
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

function findFuzzySectionMatch(normalized, matchers, preferredSection) {
  if (!preferredSection || normalized.length < 12) return null

  let best = null
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

function isHealthCenterWork(name) {
  return HEALTH_CENTER_RE.test(String(name ?? ''))
}

function isHealthCenterSection(section) {
  return HEALTH_CENTER_RE.test(String(section ?? ''))
}

function chemistryLikeSection(section) {
  if (isHealthCenterSection(section)) return HEALTH_CENTER_SECTION
  if (section === CHEMISTRY_SECTION) return CHEMISTRY_SECTION
  return null
}

function workloadRule(testName, preferredSection) {
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

function getRuleMeta(rule, matchers) {
  return rule.map(item => {
    const matches = matchers.exact.get(normalizeMatchText(item.test_name)) ?? []
    return matches.find(match => match.section === item.section)
      ?? matchers.bySection.get(item.section)?.find(match => match.test_name === item.test_name)
      ?? { ...item, code: null, price: null }
  })
}

function findWorkloadMatch(testName, matchers, preferredSection) {
  const normalized = normalizeMatchText(testName)
  if (!normalized) return null

  const exact = pickPreferredMatch(matchers.exact.get(normalized) ?? [], preferredSection)
  if (exact) return exact

  const matches = matchers.partial
    .filter(({ key }) => normalized.includes(key) || key.includes(normalized))
    .map(({ value }) => value)

  return pickPreferredMatch(matches, preferredSection) ?? findFuzzySectionMatch(normalized, matchers, preferredSection)
}

function workloadMetasForTest(testName, matchers, preferredSection) {
  const rule = workloadRule(testName, preferredSection)
  if (rule) return getRuleMeta(rule, matchers)

  const meta = findWorkloadMatch(testName, matchers, preferredSection)
  return meta ? [meta] : []
}

function toMatchedTatRows(row, matchers, year, month) {
  const preferredSection = isHealthCenterWork(row.ward) || isHealthCenterWork(row.name_1) || isHealthCenterWork(row.test_name)
    ? HEALTH_CENTER_SECTION
    : normalizeLabSection(row.lab_section)

  return workloadMetasForTest(row.test_name, matchers, preferredSection)
    .map(meta => ({ ...row, ...meta, year, month }))
}

function buildWorkloadSummary(records, phlebRows, year, month) {
  const displayFiscalYear = fiscalDisplayYear(year, month)
  const fiscalYear = displayFiscalYear - 543
  const months = fiscalMonths(fiscalYear)
  const matchers = buildWorkloadMatchers(readWorkloadTestMap())
  const matchedRows = records.flatMap(row => toMatchedTatRows(row, matchers, year, month))
  const currentRows = matchedRows.filter(row => row.year === year && row.month === month)

  const deptLn = new Map()
  const deptRows = new Map()
  const deptTests = new Map()
  const heatmapLn = new Map()
  for (const row of currentRows) {
    deptRows.set(row.section, (deptRows.get(row.section) ?? 0) + 1)
    addToSetMap(deptLn, row.section, row.ln)
    addToSetMap(deptTests, row.section, row.test_name)
    if (row.spcm_dow != null && row.spcm_hour != null) {
      addToSetMap(heatmapLn, `${row.spcm_dow}-${row.spcm_hour}`, row.ln)
    }
  }

  const sectionNames = Array.from(new Set([
    ...matchers.bySection.keys(),
    ...currentRows.map(row => row.section).filter(Boolean),
  ]))

  const departments = sectionNames
    .map(section => ({
      section,
      ln_count: countSetMap(deptLn, section),
      test_rows: deptRows.get(section) ?? 0,
      test_count: matchers.bySection.get(section)?.length ?? countSetMap(deptTests, section),
    }))
    .sort((a, b) => b.ln_count - a.ln_count || a.section.localeCompare(b.section, 'th'))

  const trend = months.map(ym => {
    if (ym.year !== year || ym.month !== month) return { year: ym.year, month: ym.month, ln_count: 0, test_rows: 0 }
    return {
      year: ym.year,
      month: ym.month,
      ln_count: new Set(currentRows.map(row => row.ln).filter(Boolean)).size,
      test_rows: currentRows.length,
    }
  })

  const zoneVisits = new Map()
  const phlebHeatmap = new Map()
  let phlebAllowedVisits = 0
  for (const row of phlebRows) {
    const zone = normalizeLabzone(row.labzone_name)
    if (!zone || !PHLEB_ALLOWED_LABZONES.includes(zone)) continue
    phlebAllowedVisits += 1
    zoneVisits.set(zone, (zoneVisits.get(zone) ?? 0) + 1)
    if (row.register_at) {
      const d = new Date(row.register_at)
      addToSetMap(phlebHeatmap, `${d.getUTCDay()}-${d.getUTCHours()}`, row.hn)
    }
  }

  const phlebotomyZones = PHLEB_ALLOWED_LABZONES
    .map(labzone_name => ({ labzone_name, hn_count: zoneVisits.get(labzone_name) ?? 0 }))
    .filter(row => row.hn_count > 0)
    .sort((a, b) => b.hn_count - a.hn_count)

  const opdRows = PHLEB_ALLOWED_LABZONES
    .map(labzone_name => {
      const values = Object.fromEntries(months.map(ym => [
        monthKey(ym.year, ym.month),
        ym.year === year && ym.month === month ? zoneVisits.get(labzone_name) ?? 0 : 0,
      ]))
      return {
        labzone_name,
        months: values,
        total: Object.values(values).reduce((sum, value) => sum + value, 0),
      }
    })
    .filter(row => row.total > 0)
    .sort((a, b) => b.total - a.total)

  const sectionMonthTestLn = new Map()
  const sectionMonthTestInTimeLn = new Map()
  const sectionMonthTestRows = new Map()
  const sectionMonthTestInTimeRows = new Map()
  for (const row of matchedRows) {
    const key = `${row.section}|${row.test_name}|${row.year}|${row.month}`
    addToSetMap(sectionMonthTestLn, key, row.ln)
    if (row.within_target === true) addToSetMap(sectionMonthTestInTimeLn, key, row.ln)
    sectionMonthTestRows.set(key, (sectionMonthTestRows.get(key) ?? 0) + 1)
    if (row.within_target === true) {
      sectionMonthTestInTimeRows.set(key, (sectionMonthTestInTimeRows.get(key) ?? 0) + 1)
    }
  }

  const sectionTests = collectSectionTests(matchers, matchedRows)
  const sectionDetails = {}
  for (const [section, workloadTests] of sectionTests.entries()) {
    const tests = workloadTests
      .map(test => {
        const monthsData = Object.fromEntries(months.map(ym => {
          const key = `${section}|${test.test_name}|${ym.year}|${ym.month}`
          return [monthKey(ym.year, ym.month), {
            in_time: countSetMap(sectionMonthTestInTimeLn, key),
            total: countSetMap(sectionMonthTestLn, key),
            row_in_time: sectionMonthTestInTimeRows.get(key) ?? 0,
            row_total: sectionMonthTestRows.get(key) ?? 0,
          }]
        }))
        const selected = monthsData[monthKey(year, month)]
        return {
          test_name: test.test_name,
          code: test.code,
          price: test.price,
          current_total: selected?.total ?? 0,
          current_test_rows: selected?.row_total ?? 0,
          fiscal_total: Object.values(monthsData).reduce((sum, value) => sum + value.total, 0),
          fiscal_test_rows: Object.values(monthsData).reduce((sum, value) => sum + value.row_total, 0),
          months: monthsData,
        }
      })
      .sort((a, b) => b.current_total - a.current_total || b.current_test_rows - a.current_test_rows)

    sectionDetails[section] = tests
  }

  return {
    precomputed: true,
    source: 'local-etl',
    fiscal_year: displayFiscalYear,
    selected_year: year,
    selected_month: month,
    months,
    kpi: {
      total_ln: new Set(currentRows.map(row => row.ln).filter(Boolean)).size,
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
}

function buildSummary(allTatRecords, phlebRows, year, month, filters = {}) {
  const base = allTatRecords.filter(r =>
    (!filters.priority || r.priority === filters.priority)
    && (!filters.lab_section || r.lab_section === filters.lab_section)
    && (!filters.ward || r.ward === filters.ward)
    && (!filters.test_name || r.test_name === filters.test_name)
    && (!filters.labzone_name || r.labzone_name === filters.labzone_name)
  )
  const baseMatch = allTatRecords.filter(r =>
    (!filters.priority || r.priority === filters.priority)
    && (!filters.lab_section || r.lab_section === filters.lab_section)
    && (!filters.ward || r.ward === filters.ward)
    && (!filters.test_name || r.test_name === filters.test_name)
  )

  const targetRows = base.filter(r => r.within_target !== null)
  const bloodRows = base.filter(r => r.is_blood_draw)
  const matchedBloodRows = bloodRows.filter(r => r.match_confidence !== 'no_match')
  const sampleKeys = new Set(base.map(r => r.ln).filter(Boolean))
  const tatValues = base.map(r => Number(r.tat_minutes)).filter(Number.isFinite)
  const targetValues = targetRows.filter(r => r.within_target === true).length

  const samples = new Map()
  for (const row of bloodRows) {
    const key = row.ln || `${row.hn}|${row.spcm_at}`
    const sample = samples.get(key) ?? { register: null, result: null, matched: false, labTat: null, wait: null, draw: null, transport: null }
    if (row.register_at) sample.register = Math.min(sample.register ?? Infinity, toMs(row.register_at))
    if (row.rslt_at) sample.result = Math.max(sample.result ?? -Infinity, toMs(row.rslt_at))
    if (row.tat_minutes != null) sample.labTat = Math.max(sample.labTat ?? 0, Number(row.tat_minutes))
    if (row.phleb_wait_minutes != null) sample.wait = Math.min(sample.wait ?? Infinity, Number(row.phleb_wait_minutes))
    if (row.phleb_draw_minutes != null) sample.draw = Math.min(sample.draw ?? Infinity, Number(row.phleb_draw_minutes))
    if (row.transport_minutes != null) sample.transport = Math.min(sample.transport ?? Infinity, Number(row.transport_minutes))
    if (row.match_confidence !== 'no_match') sample.matched = true
    samples.set(key, sample)
  }
  const sampleList = Array.from(samples.values())
  const matchedSamples = sampleList.filter(s => s.matched)
  const totalTat = matchedSamples.map(s => Number.isFinite(s.register) && Number.isFinite(s.result) ? (s.result - s.register) / 60000 : NaN).filter(Number.isFinite)
  const totalTatCut = totalTat.filter(v => v <= 720)

  const matchSamples = new Map()
  for (const row of baseMatch.filter(r => r.is_blood_draw)) {
    const key = row.ln || `${row.hn}|${row.spcm_at}`
    const current = matchSamples.get(key) ?? 'no_match'
    if (row.match_confidence === 'exact') matchSamples.set(key, 'exact')
    else if (row.match_confidence === 'ambiguous' && current !== 'exact') matchSamples.set(key, 'ambiguous')
    else if (!matchSamples.has(key)) matchSamples.set(key, 'no_match')
  }
  const matchValues = Array.from(matchSamples.values())

  const busiest = Array.from(groupCount(base, r => r.spcm_hour).entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
  const phlebWaits = phlebRows.map(r => Number(r.wait_minutes)).filter(Number.isFinite)

  const bySection = Array.from(groupCount(base, r => r.lab_section || 'ไม่ระบุ').keys()).map(section => {
    const rows = base.filter(r => (r.lab_section || 'ไม่ระบุ') === section)
    return { lab_section: section, avg_tat: avg(rows.map(r => Number(r.tat_minutes))), count: new Set(rows.map(r => r.ln).filter(Boolean)).size }
  }).sort((a, b) => b.avg_tat - a.avg_tat)

  const byLabzone = Array.from(groupCount(base.filter(r => r.labzone_name), r => r.labzone_name).keys()).map(zone => {
    const rows = base.filter(r => r.labzone_name === zone)
    return { labzone_name: zone, count: new Set(rows.map(r => r.ln).filter(Boolean)).size, avg_wait: avg(rows.map(r => Number(r.phleb_wait_minutes))) }
  }).sort((a, b) => b.count - a.count)

  const byLabzonePhleb = Array.from(groupCount(phlebRows.filter(r => !filters.labzone_name || r.labzone_name === filters.labzone_name), r => r.labzone_name).keys()).map(zone => {
    const rows = phlebRows.filter(r => r.labzone_name === zone)
    return { labzone_name: zone, count: new Set(rows.map(r => r.hn).filter(Boolean)).size }
  }).sort((a, b) => b.count - a.count)

  const distCounts = BINS.map((bin, i) => ({
    bin_idx: i,
    bin: bin.label,
    count: tatValues.filter(v => (i === 0 ? v < bin.max : v >= BINS[i - 1].max && v < bin.max)).length,
  }))
  let running = 0
  const tatDistribution = distCounts.map(d => {
    running += d.count
    return { bin: d.bin, count: d.count, cumulative_pct: pct(running, tatValues.length) }
  })

  return {
    precomputed: true,
    source: 'local-etl',
    year,
    month,
    kpi: {
      total_count: base.length,
      sample_count: sampleKeys.size,
      blood_sample_count: samples.size,
      target_count: targetRows.length,
      target_coverage_pct: pct(targetRows.length, base.length),
      avg_tat: avg(tatValues),
      median_tat: median(tatValues),
      pct_within_target: pct(targetValues, targetRows.length),
      busiest_hour: `${String(busiest).padStart(2, '0')}:00-${String(Number(busiest) + 1).padStart(2, '0')}:00`,
      avg_phleb_wait: avg(phlebWaits),
      pipeline_avg_phleb_wait: avg(matchedSamples.map(s => Number(s.wait))),
      pipeline_avg_phleb_draw: avg(matchedSamples.map(s => Number(s.draw))),
      avg_transport: avg(matchedSamples.map(s => Number(s.transport))),
      avg_total_tat: avg(totalTat),
      avg_total_tat_cut_720: avg(totalTatCut),
      median_total_tat: median(totalTat),
      median_total_tat_cut_720: median(totalTatCut),
      total_tat_cut_720_count: totalTatCut.length,
      total_tat_outlier_720_count: totalTat.length - totalTatCut.length,
      phleb_match_rate: pct(matchValues.filter(v => v !== 'no_match').length, matchValues.length),
      pct_total_within_target: pct(totalTat.filter(v => v <= 120).length, totalTat.length),
      pct_phleb_within_target: pct(phlebWaits.filter(v => v <= 30).length, phlebWaits.length, 2),
    },
    hn_null_count: base.filter(r => !r.hn).length,
    has_phleb_data: phlebRows.length > 0,
    phleb_record_count: phlebRows.length,
    phleb_hn_count: new Set(phlebRows.map(r => r.hn).filter(Boolean)).size,
    match_breakdown: {
      exact: matchValues.filter(v => v === 'exact').length,
      ambiguous: matchValues.filter(v => v === 'ambiguous').length,
      no_match: matchValues.filter(v => v === 'no_match').length,
    },
    stage_breakdown: [
      { stage: STAGES.wait, avg_minutes: avg(matchedSamples.map(s => Number(s.wait))) },
      { stage: STAGES.draw, avg_minutes: avg(matchedSamples.map(s => Number(s.draw))) },
      { stage: STAGES.transport, avg_minutes: avg(matchedSamples.map(s => Number(s.transport))) },
      { stage: STAGES.lab, avg_minutes: avg(matchedSamples.map(s => Number(s.labTat))) },
    ],
    by_lab_section: bySection,
    by_labzone: byLabzone,
    by_labzone_phleb: byLabzonePhleb,
    tat_distribution: tatDistribution,
    heatmap: buildHeatmap(base, 'spcm_at'),
    phleb_heatmap: buildHeatmap(phlebRows, 'register_at', 'hn'),
    trend: [{ year, month, avg_tat: avg(tatValues), pct_within_target: pct(targetValues, targetRows.length) }],
    filter_options: {
      lab_sections: unique(allTatRecords.map(r => r.lab_section)),
      wards: unique(allTatRecords.map(r => r.ward)),
      test_names: unique(allTatRecords.map(r => r.test_name)),
      labzone_names: unique(allTatRecords.map(r => r.labzone_name)),
      phleb_labzone_names: unique(phlebRows.map(r => r.labzone_name)),
    },
  }
}

function detectYearMonth(rows) {
  const counts = new Map()
  for (const r of rows) {
    const d = new Date(r.spcm_at ?? r.register_at)
    if (!Number.isFinite(d.getTime())) continue
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const [best] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  if (!best) throw new Error('Cannot detect year/month from input files')
  const [year, month] = best[0].split('-').map(Number)
  return { year, month }
}

function cacheKey(year, month, filters = {}) {
  return [
    CACHE_VERSION,
    String(year),
    String(month),
    filters.lab_section ?? '',
    filters.ward ?? '',
    filters.priority ?? '',
    filters.test_name ?? '',
    filters.labzone_name ?? '',
  ].join('|')
}

function workloadCacheKey(displayFiscalYear, fiscalYear, selectedYear, selectedMonth, uploadVersion) {
  return [
    WORKLOAD_CACHE_VERSION,
    String(displayFiscalYear),
    String(fiscalYear),
    String(selectedYear),
    String(selectedMonth),
    uploadVersion,
  ].join('|')
}

async function publishSummary(supabase, year, month, payload, filters = {}) {
  const { error } = await supabase
    .from('analysis_summary_cache')
    .upsert({
      endpoint: CACHE_ENDPOINT,
      cache_key: cacheKey(year, month, filters),
      year,
      month,
      payload,
      expires_at: new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint,cache_key' })

  if (error) throw new Error(error.message)
}

async function readCachedSummary(supabase, endpoint, cacheKeyValue) {
  const { data, error } = await supabase
    .from('analysis_summary_cache')
    .select('payload')
    .eq('endpoint', endpoint)
    .eq('cache_key', cacheKeyValue)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error) return null
  return data?.payload ?? null
}

function hasMissingWorkloadHeatmapWarning(payload) {
  return (payload?.warnings ?? []).some(w => String(w).includes('precomputed heatmap') || String(w).includes('API ยังไม่เห็นตาราง'))
}

function hasWorkloadRulesPayload(payload) {
  return payload
    && Array.isArray(payload.departments)
    && payload.section_details
    && !hasMissingWorkloadHeatmapWarning(payload)
}

function hasWorkloadMonthValues(payload, year, month) {
  if (!hasWorkloadRulesPayload(payload)) return false
  const key = monthKey(year, month)
  return Object.values(payload.section_details ?? {}).some(sectionRows =>
    Array.isArray(sectionRows) && sectionRows.some(row => {
      const monthValue = row.months?.[key]
      return Number(monthValue?.total ?? 0) > 0
        || Number(monthValue?.row_total ?? 0) > 0
        || (payload.selected_year === year && payload.selected_month === month && Number(row.current_total ?? 0) > 0)
        || (payload.selected_year === year && payload.selected_month === month && Number(row.current_test_rows ?? 0) > 0)
    })
  )
}

async function readLatestMonthSummary(supabase, endpoint, year, month) {
  let query = supabase
    .from('analysis_summary_cache')
    .select('payload')
    .eq('endpoint', endpoint)
    .eq('year', year)
    .eq('month', month)
    .gt('expires_at', new Date().toISOString())

  if (endpoint === WORKLOAD_CACHE_ENDPOINT) {
    query = query.like('cache_key', `${WORKLOAD_CACHE_VERSION}|%`)
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) return null
  const rows = data ?? []
  if (endpoint !== WORKLOAD_CACHE_ENDPOINT) return rows[0]?.payload ?? null
  const payloads = rows.map(row => row.payload).filter(hasWorkloadRulesPayload)
  return payloads.find(payload => hasWorkloadMonthValues(payload, year, month))
    ?? payloads[0]
    ?? null
}

async function enrichTatTrendFromCache(supabase, payload, year, month, filters = {}) {
  const months = rollingMonths(year, month, 12)
  const trend = []

  for (const ym of months) {
    const monthPayload = ym.year === year && ym.month === month
      ? payload
      : await readCachedSummary(supabase, CACHE_ENDPOINT, cacheKey(ym.year, ym.month, filters))
    const kpi = monthPayload?.kpi ?? {}
    trend.push({
      year: ym.year,
      month: ym.month,
      avg_tat: Number(kpi.avg_tat ?? 0),
      pct_within_target: Number(kpi.pct_within_target ?? 0),
    })
  }

  return { ...payload, trend }
}

function selectedMonthValue(row, year, month, field) {
  const value = row?.months?.[monthKey(year, month)]?.[field]
  return Number(value ?? 0)
}

function collectCachedSectionTests(monthPayloads) {
  const testsBySection = new Map()
  const seenBySection = new Map()

  for (const monthPayload of monthPayloads.values()) {
    for (const [section, rows] of Object.entries(monthPayload?.section_details ?? {})) {
      if (!Array.isArray(rows)) continue
      if (!testsBySection.has(section)) testsBySection.set(section, [])
      if (!seenBySection.has(section)) seenBySection.set(section, new Set())

      const seen = seenBySection.get(section)
      for (const test of rows) {
        if (!test?.test_name || seen.has(test.test_name)) continue
        seen.add(test.test_name)
        testsBySection.get(section).push({
          test_name: test.test_name,
          code: test.code ?? null,
          price: test.price ?? null,
        })
      }
    }
  }

  return testsBySection
}

async function enrichWorkloadFiscalFromCache(supabase, payload, year, month) {
  const months = payload.months ?? fiscalMonths(fiscalDisplayYear(year, month) - 543)
  const monthPayloads = new Map()

  for (const ym of months) {
    const key = monthKey(ym.year, ym.month)
    monthPayloads.set(key, ym.year === year && ym.month === month
      ? payload
      : await readLatestMonthSummary(supabase, WORKLOAD_CACHE_ENDPOINT, ym.year, ym.month))
  }

  const trend = months.map(ym => {
    const monthPayload = monthPayloads.get(monthKey(ym.year, ym.month))
    const kpi = monthPayload?.kpi ?? {}
    return {
      year: ym.year,
      month: ym.month,
      ln_count: Number(kpi.total_ln ?? 0),
      test_rows: Number(kpi.total_test_rows ?? 0),
    }
  })

  const opdRows = PHLEB_ALLOWED_LABZONES
    .map(labzone_name => {
      const values = Object.fromEntries(months.map(ym => {
        const monthPayload = monthPayloads.get(monthKey(ym.year, ym.month))
        const row = (monthPayload?.opd_rows ?? []).find(r => r.labzone_name === labzone_name)
        return [monthKey(ym.year, ym.month), Number(row?.months?.[monthKey(ym.year, ym.month)] ?? 0)]
      }))
      return {
        labzone_name,
        months: values,
        total: Object.values(values).reduce((sum, value) => sum + value, 0),
      }
    })
    .filter(row => row.total > 0)
    .sort((a, b) => b.total - a.total)

  const sectionDetails = {}
  for (const [section, rows] of Object.entries(payload.section_details ?? {})) {
    sectionDetails[section] = rows.map(test => {
      const monthsData = Object.fromEntries(months.map(ym => {
        const monthPayload = monthPayloads.get(monthKey(ym.year, ym.month))
        const source = (monthPayload?.section_details?.[section] ?? []).find(row => row.test_name === test.test_name)
        const sourceMonth = source?.months?.[monthKey(ym.year, ym.month)]
        return [monthKey(ym.year, ym.month), {
          in_time: Number(sourceMonth?.in_time ?? 0),
          total: Number(sourceMonth?.total ?? 0),
          row_in_time: Number(sourceMonth?.row_in_time ?? 0),
          row_total: Number(sourceMonth?.row_total ?? 0),
        }]
      }))
      const selected = monthsData[monthKey(year, month)]
      return {
        ...test,
        current_total: selected?.total ?? 0,
        current_test_rows: selected?.row_total ?? 0,
        fiscal_total: Object.values(monthsData).reduce((sum, value) => sum + value.total, 0),
        fiscal_test_rows: Object.values(monthsData).reduce((sum, value) => sum + value.row_total, 0),
        months: monthsData,
      }
    })
  }

  return {
    ...payload,
    trend,
    opd_rows: opdRows,
    section_details: sectionDetails,
  }
}

function localUploadVersion(tatRowCount, phlebRowCount) {
  return `local-tat:${tatRowCount}|local-phleb:${phlebRowCount}`
}

async function publishWorkloadSummary(supabase, year, month, uploadVersion, payload) {
  const displayFiscalYear = fiscalDisplayYear(year, month)
  const fiscalYear = displayFiscalYear - 543
  const key = workloadCacheKey(displayFiscalYear, fiscalYear, year, month, uploadVersion)
  const { error } = await supabase
    .from('analysis_summary_cache')
    .upsert({
      endpoint: WORKLOAD_CACHE_ENDPOINT,
      cache_key: key,
      year,
      month,
      payload,
      expires_at: new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint,cache_key' })

  if (error) throw new Error(error.message)
  return key
}

async function fetchDbRows(supabase, table, select, year, month) {
  const rows = []
  let cursor = null
  for (;;) {
    let query = supabase
      .from(table)
      .select(select)
      .eq('year', year)
      .eq('month', month)
      .order('id', { ascending: true })
      .limit(1000)

    if (cursor) query = query.gt('id', cursor)
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)

    const page = data ?? []
    rows.push(...page)
    if (rows.length % 50000 < page.length) {
      console.log(`${table}: ${rows.length.toLocaleString()} rows...`)
    }
    if (page.length < 1000) break
    cursor = page[page.length - 1]?.id
    if (!cursor) break
  }
  return rows
}

async function publishDbWorkloadSummary(supabase, year, month) {
  console.log(`Loading DB records for ${year}-${String(month).padStart(2, '0')}...`)
  const [tatRows, phlebRows] = await Promise.all([
    fetchDbRows(
      supabase,
      'tat_records',
      'id,year,month,ln,lab_section,test_name,name_1,within_target,spcm_hour,spcm_dow',
      year,
      month,
    ),
    fetchDbRows(
      supabase,
      'phlebotomy_records',
      'id,year,month,hn,labzone_name,register_at',
      year,
      month,
    ),
  ])

  console.log(`Loaded TAT ${tatRows.length.toLocaleString()} rows`)
  console.log(`Loaded Phlebotomy ${phlebRows.length.toLocaleString()} rows`)
  console.log('Building workload summary with rule engine...')
  const workloadPayload = await enrichWorkloadFiscalFromCache(
    supabase,
    buildWorkloadSummary(tatRows, phlebRows, year, month),
    year,
    month,
  )

  console.log('Publishing workload cache...')
  const workloadKey = await publishWorkloadSummary(
    supabase,
    year,
    month,
    `db-tat:${tatRows.length}|db-phleb:${phlebRows.length}`,
    workloadPayload,
  )
  console.log(`Workload cache key:     ${workloadKey}`)
}

async function main() {
  const a = args()
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  if (a['from-db']) {
    const year = Number(a.year)
    const month = Number(a.month)
    if (!year || !month) throw new Error('--from-db requires --year and --month')
    await publishDbWorkloadSummary(supabase, year, month)
    return
  }

  if (!a.tat || !a.phleb || a.help) {
    usage()
    process.exit(a.help ? 0 : 1)
  }

  console.log('Reading files...')
  const tat = parseTatFile(a.tat)
  const phleb = parsePhlebFile(a.phleb)
  const detected = detectYearMonth(tat.rows)
  const year = Number(a.year ?? detected.year)
  const month = Number(a.month ?? detected.month)

  console.log(`Parsed TAT ${tat.rows.length.toLocaleString()} rows (${tat.invalid} invalid)`)
  console.log(`Parsed Phlebotomy ${phleb.rows.length.toLocaleString()} rows (${phleb.invalid} invalid)`)
  console.log(`Month: ${year}-${String(month).padStart(2, '0')}`)

  console.log('Loading test target/tube map from Supabase...')
  const maps = await fetchTestMaps(supabase)

  console.log('Splitting TAT panels and matching phlebotomy...')
  const records = splitTatRows(tat.rows, maps)
  joinPhleb(records, phleb.rows)

  console.log('Building summaries...')
  const mainPayload = await enrichTatTrendFromCache(supabase, buildSummary(records, phleb.rows, year, month), year, month)
  const urgentPayload = await enrichTatTrendFromCache(
    supabase,
    buildSummary(records, phleb.rows, year, month, { priority: URGENT_PRIORITY }),
    year,
    month,
    { priority: URGENT_PRIORITY },
  )
  const workloadPayload = await enrichWorkloadFiscalFromCache(
    supabase,
    buildWorkloadSummary(records, phleb.rows, year, month),
    year,
    month,
  )

  console.log('Publishing summary caches...')
  const uploadVersion = localUploadVersion(records.length, phleb.rows.length)
  await publishSummary(supabase, year, month, mainPayload)
  await publishSummary(supabase, year, month, urgentPayload, { priority: URGENT_PRIORITY })
  const workloadKey = await publishWorkloadSummary(supabase, year, month, uploadVersion, workloadPayload)

  console.log('Done.')
  console.log(`TAT main cache key:     ${cacheKey(year, month)}`)
  console.log(`TAT urgent cache key:   ${cacheKey(year, month, { priority: URGENT_PRIORITY })}`)
  console.log(`Workload cache key:     ${workloadKey}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
