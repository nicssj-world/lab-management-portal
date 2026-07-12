// Import KPI ปีงบ 2569 จาก Google Sheet → kpi_entries (idempotent)
// Run: node scripts/kpi-import-gsheet.mjs
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServiceEnv } from './lib/env.mjs'

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_KEY } = getSupabaseServiceEnv()
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const SHEET_ID = '1mD3DYhjhwoacFrthVh-LGwGCAa5PZ_zb-SskuKdqeOs'
const FISCAL_YEAR = 2569

// dept code → gid (tab)
const DEPT_GIDS = {
  CHE: 322761202, IMM: 1887326764, HEM: 1711797343, MIS: 1768869272,
  MIC: 652615890, MOL: 1953229400, BLB: 1004241559, OUT: 1646403832,
  MCL: 1899654640, OPD: 99206725,
}

// CSV column index → fiscal month.  Months col 4..15 = ต.ค.(10) … ก.ย.(9)
// Import only ต.ค.–มิ.ย. (indices 4..12) — later months have no real data yet.
const MONTH_COLS = [
  [4, 10], [5, 11], [6, 12], [7, 1], [8, 2], [9, 3], [10, 4], [11, 5], [12, 6],
]

function norm(s) {
  return String(s ?? '').replace(/"/g, '').replace(/\s+/g, ' ').trim()
}

function parseNum(v) {
  const s = String(v ?? '').replace(/,/g, '').trim()
  if (s === '' || s === '-') return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

async function fetchCsv(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`fetch ${gid} → HTTP ${res.status}`)
  const text = await res.text()
  const wb = XLSX.read(text, { type: 'string' })
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' })
}

// Classify a row's label → { kind: 'num'|'den', kpi } | null
function classify(label, lastRiskNumKpi) {
  const l = label
  if (l.startsWith('ร้อยละ')) return null // percent rows are recomputed by us

  // --- denominators ---
  if (l.includes('ขอส่งตรวจ') && l.includes('Routine')) return { kind: 'den', kpi: 'TAT_ROUTINE' }
  if (l.includes('ขอส่งตรวจ') && l.includes('Stroke')) return { kind: 'den', kpi: 'TAT_STROKE' }
  if (l.includes('ค่าวิกฤติทั้งหมด')) return { kind: 'den', kpi: 'TAT_CRITICAL' }
  // Uncross denominator: numerator row has 'ทันเวลา', denominator row doesn't.
  // (sheet label is sometimes mistyped 'ทัั้งหมด', so don't rely on that word.)
  if (l.includes('เตรียมและจ่ายเลือด') && !l.includes('ทันเวลา')) return { kind: 'den', kpi: 'TAT_UNCROSS' }
  if (l.includes('รายงานอุบัติการณ์ทั้งหมด') || (l.includes('อุบัติการณ์ทั้งหมด'))) {
    return lastRiskNumKpi ? { kind: 'den', kpi: lastRiskNumKpi } : null
  }

  // --- numerators ---
  if (l.includes('Routine') && l.includes('ทันเวลา')) return { kind: 'num', kpi: 'TAT_ROUTINE' }
  if (l.includes('Stroke') && l.includes('ทันเวลา') && l.includes('นาที')) return { kind: 'num', kpi: 'TAT_STROKE' }
  if (l.includes('ค่าวิกฤติทันเวลา') || (l.includes('ค่าวิกฤติ') && l.includes('ทันเวลา'))) return { kind: 'num', kpi: 'TAT_CRITICAL' }
  if (l.includes('เตรียมและจ่ายเลือดทันเวลา')) return { kind: 'num', kpi: 'TAT_UNCROSS' }
  if (l.includes('คลาดเคลื่อนหรือผิดพลาด') && l.includes('ครั้ง')) return { kind: 'num', kpi: 'ERR_REPORT' }
  if (l.includes('ผู้ป่วยได้รับเลือดผิด')) return { kind: 'num', kpi: 'RISK_BLOOD' }
  if (l.includes('เจาะเลือดผิด') && l.includes('OPD')) return { kind: 'num', kpi: 'RISK_ID_OPD' }
  if (l.includes('เจาะเลือดผิด') && l.includes('หอผู้ป่วยใน')) return { kind: 'num', kpi: 'RISK_ID_WARD' }
  if (l.includes('สติ๊กเกอร์ผิด')) return { kind: 'num', kpi: 'RISK_STICKER' }
  if ((l.includes('A - B') || l.includes('A-B')) && l.includes('อุบัติการณ์')) return { kind: 'num', kpi: 'RISK_NEARMISS' }
  if (l.includes('C-D') && l.includes('Low Risk')) return { kind: 'num', kpi: 'RISK_LOWRISK' }
  if (l.includes('E-F') || l.includes('Moderate')) return { kind: 'num', kpi: 'RISK_MODERATE' }
  if (l.includes('G-I') || l.includes('Sentinel')) return { kind: 'num', kpi: 'RISK_SENTINEL' }
  return null
}

const COUNT_KPIS = new Set(['RISK_BLOOD', 'RISK_ID_OPD', 'RISK_ID_WARD', 'RISK_STICKER', 'RISK_MODERATE', 'RISK_SENTINEL'])

// Parse one department tab → Map<`${kpi}|${month}`, {num, den}>
function parseDept(rows, warnings, deptCode) {
  const acc = new Map() // key → { num, den }
  let lastRiskNumKpi = null

  for (const row of rows) {
    const label = norm(row[2]) || norm(row[1])
    if (!label) continue
    const c = classify(label, lastRiskNumKpi)
    if (!c) continue

    if (c.kind === 'num' && (c.kpi === 'RISK_NEARMISS' || c.kpi === 'RISK_LOWRISK')) {
      lastRiskNumKpi = c.kpi
    }

    for (const [col, month] of MONTH_COLS) {
      const v = parseNum(row[col])
      if (v === null) continue
      const key = `${c.kpi}|${month}`
      const entry = acc.get(key) ?? { num: null, den: null }
      if (c.kind === 'num') entry.num = v
      else entry.den = v
      acc.set(key, entry)
    }
  }

  // ERR_REPORT denominator = TAT_ROUTINE denominator (same month)
  for (const [, month] of MONTH_COLS) {
    const err = acc.get(`ERR_REPORT|${month}`)
    if (err && err.num !== null && err.den === null) {
      const routineDen = acc.get(`TAT_ROUTINE|${month}`)?.den ?? null
      if (routineDen !== null) err.den = routineDen
    }
  }
  return acc
}

const DRY = process.argv.includes('--dry-run')

async function main() {
  // Load dept + kpi id maps (dry-run: passthrough code→code, no DB needed)
  let deptId, kpiId
  if (DRY) {
    deptId = new Map(Object.keys(DEPT_GIDS).map((c) => [c, c]))
    kpiId = new Map(['TAT_ROUTINE', 'TAT_STROKE', 'TAT_CRITICAL', 'TAT_UNCROSS', 'ERR_REPORT',
      'RISK_BLOOD', 'RISK_ID_OPD', 'RISK_ID_WARD', 'RISK_STICKER', 'RISK_NEARMISS', 'RISK_LOWRISK',
      'RISK_MODERATE', 'RISK_SENTINEL'].map((c) => [c, c]))
  } else {
    const [{ data: depts }, { data: defs }] = await Promise.all([
      supabase.from('departments').select('id, code'),
      supabase.from('kpi_definitions').select('id, code'),
    ])
    deptId = new Map((depts ?? []).map((d) => [d.code, d.id]))
    kpiId = new Map((defs ?? []).map((k) => [k.code, k.id]))
  }

  const warnings = []
  const rowsToUpsert = []
  const perDept = {}

  for (const [code, gid] of Object.entries(DEPT_GIDS)) {
    if (!deptId.has(code)) { warnings.push(`ไม่พบแผนก ${code} ใน DB`); continue }
    let rows
    try {
      rows = await fetchCsv(gid)
    } catch (e) {
      warnings.push(`${code}: ดึงข้อมูลไม่ได้ — ${e.message}`)
      continue
    }
    const acc = parseDept(rows, warnings, code)
    let n = 0
    for (const [key, { num, den }] of acc) {
      const [kpi, monthStr] = key.split('|')
      const month = Number(monthStr)
      if (!kpiId.has(kpi)) { warnings.push(`${code}: ไม่พบ KPI ${kpi}`); continue }
      if (num === null) continue
      const isCount = COUNT_KPIS.has(kpi)
      if (!isCount) {
        // percent KPI: need denominator; skip 0/0 (dept ไม่ได้ทำตัวชี้วัดนี้)
        if (den === null) continue
        if (num === 0 && den === 0) continue
      }
      rowsToUpsert.push({
        dept_id: deptId.get(code),
        kpi_id: kpiId.get(kpi),
        fiscal_year: FISCAL_YEAR,
        month,
        numerator: num,
        denominator: isCount ? null : den,
        result_pct: isCount ? null : (den ? Math.round((num / den) * 10000) / 100 : null),
      })
      n++
    }
    perDept[code] = n
  }

  if (DRY) {
    // Print a few sanity samples instead of writing
    const sample = (code, kpi) => rowsToUpsert
      .filter((r) => r.dept_id === code && r.kpi_id === kpi)
      .sort((a, b) => MONTH_COLS.findIndex(([, m]) => m === a.month) - MONTH_COLS.findIndex(([, m]) => m === b.month))
      .map((r) => `${r.month}:${r.numerator}/${r.denominator ?? '-'}${r.result_pct != null ? `=${r.result_pct}%` : ''}`)
      .join('  ')
    console.log('\n--- DRY RUN samples ---')
    console.log('CHE TAT_ROUTINE :', sample('CHE', 'TAT_ROUTINE'))
    console.log('BLB TAT_UNCROSS :', sample('BLB', 'TAT_UNCROSS'))
    console.log('HEM RISK_NEARMISS:', sample('HEM', 'RISK_NEARMISS'))
    console.log('HEM RISK_LOWRISK:', sample('HEM', 'RISK_LOWRISK'))
    console.log('HEM RISK_STICKER:', sample('HEM', 'RISK_STICKER'))
  } else {
    // Upsert in one batch
    if (rowsToUpsert.length > 0) {
      const { error } = await supabase
        .from('kpi_entries')
        .upsert(rowsToUpsert, { onConflict: 'dept_id,kpi_id,fiscal_year,month' })
      if (error) throw error
    }

    // Satisfaction: donor 2569 = 93.1
    const { error: satErr } = await supabase
      .from('kpi_satisfaction')
      .upsert(
        [{ metric_code: 'donor', metric_name: 'ผู้รับบริจาคโลหิต', fiscal_year: FISCAL_YEAR, value: 93.1 }],
        { onConflict: 'metric_code,fiscal_year' }
      )
    if (satErr) warnings.push(`satisfaction: ${satErr.message}`)
  }

  // Summary
  console.log('\n=== สรุปการนำเข้า KPI ปีงบ', FISCAL_YEAR, '===')
  for (const code of Object.keys(DEPT_GIDS)) {
    console.log(`  ${code.padEnd(4)} : ${perDept[code] ?? 0} แถว`)
  }
  console.log(`  รวม upsert : ${rowsToUpsert.length} แถว`)
  console.log(`  satisfaction donor 2569 = 93.1`)
  if (warnings.length) {
    console.log('\n⚠ คำเตือน:')
    for (const w of warnings) console.log('  -', w)
  }
  console.log('\n✓ เสร็จสิ้น')
}

main().catch((e) => { console.error('ล้มเหลว:', e); process.exit(1) })
