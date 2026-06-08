// Import PM/CAL schedule data from sheet into equipment.pm_cal_data
// Run AFTER: ALTER TABLE equipment ADD COLUMN IF NOT EXISTS pm_cal_data jsonb;
// Run: node scripts/import-pmcal.mjs
import XLSX from 'xlsx'
import { getSupabaseServiceEnv } from './lib/env.mjs'

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_KEY } = getSupabaseServiceEnv()

// Month name → index 0-11
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const PM_COL  = m => 17 + m * 2
const CAL_COL = m => 18 + m * 2

function cell(row, idx) { return String(row[idx] ?? '').trim() }

function parseThaiDate(v) {
  const s = String(v ?? '').trim()
  if (!s || s === '-' || s.includes('#')) return null
  // DD/MM/YYYY Buddhist
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const d = parseInt(m[1]), mo = parseInt(m[2]), y = parseInt(m[3])
    const ce = y > 2400 ? y - 543 : y
    if (ce >= 1900 && ce <= 2100) return `${ce}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }
  // DD/MM/YY Buddhist short
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (m2) {
    const d = parseInt(m2[1]), mo = parseInt(m2[2]), be = 2500 + parseInt(m2[3])
    const ce = be - 543
    if (ce >= 1900 && ce <= 2100) return `${ce}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }
  return null
}

async function getDBEquipment() {
  const cbhMap  = new Map() // cbh_code → id
  const snMap   = new Map() // serial_number → id
  let offset = 0
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/equipment?select=id,cbh_code,serial_number&limit=1000&offset=${offset}`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    )
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) break
    for (const r of rows) {
      if (r.cbh_code && r.cbh_code !== '-') cbhMap.set(r.cbh_code.trim(), r.id)
      if (r.serial_number && r.serial_number !== '-') snMap.set(r.serial_number.trim(), r.id)
    }
    if (rows.length < 1000) break
    offset += 1000
  }
  return { cbhMap, snMap }
}

async function updatePmCal(id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/equipment?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify({ pm_cal_data: data }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
}

async function main() {
  console.log('Loading DB equipment records...')
  const { cbhMap, snMap } = await getDBEquipment()
  console.log(`DB: ${cbhMap.size} CBH codes, ${snMap.size} serial numbers\n`)

  const wb = XLSX.readFile('data/equipment-new.xlsx')
  const ws = wb.Sheets['รวมงาน (2)']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false })

  let updated = 0, notFound = 0
  const seenIds = new Set()

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i]
    const itemNo = parseInt(row[3])
    if (isNaN(itemNo) || itemNo < 1) continue
    const eqType = cell(row, 9)
    if (!eqType || eqType.toLowerCase().includes('total')) continue

    // Find DB id
    const cbhRaw = cell(row, 7)
    const cbh = (cbhRaw && cbhRaw !== '-' && cbhRaw !== 'ไม่มี' && cbhRaw !== 'รอขอ') ? cbhRaw : null
    const serial = cell(row, 12) || null

    let id = null
    if (cbh) id = cbhMap.get(cbh) ?? null
    if (!id && serial && serial !== '-') id = snMap.get(serial) ?? null

    if (!id || seenIds.has(id)) { notFound++; continue }
    seenIds.add(id)

    // Build PM/CAL data  ("1" หรือ "/" หมายถึงมีแผน)
    function isPlanned(v) { const s = v.trim(); return s === '1' || s === '/' }
    const plan = {}
    MONTHS.forEach((name, m) => {
      const pm  = isPlanned(cell(row, PM_COL(m)))
      const cal = isPlanned(cell(row, CAL_COL(m)))
      plan[name] = { pm, cal }
    })

    const techGroup  = cell(row, 14)
    const timesPm    = parseFloat(cell(row, 15)) || null
    const timesCal   = parseFloat(cell(row, 16)) || null
    const lastPmDate = parseThaiDate(cell(row, 42))
    const lastCalDate= parseThaiDate(cell(row, 43))
    const certNo     = cell(row, 45) || null
    const errorVal   = cell(row, 46) || null
    const uncertainty= cell(row, 47) || null
    const calResult  = cell(row, 49) || null
    const calRemark  = (cell(row, 41) && !cell(row, 41).startsWith('#')) ? cell(row, 41) : null

    const pmCalData = {
      tech_group: techGroup || null,
      times_pm: timesPm,
      times_cal: timesCal,
      plan,
      last_pm_date: lastPmDate,
      last_cal_date: lastCalDate,
      certificate_no: (certNo && !certNo.startsWith('#')) ? certNo : null,
      error_value: (errorVal && errorVal !== '-' && !errorVal.startsWith('#')) ? errorVal : null,
      uncertainty: (uncertainty && uncertainty !== '-' && !uncertainty.startsWith('#')) ? uncertainty : null,
      cal_result: (calResult && !calResult.startsWith('#')) ? calResult : null,
      remark: calRemark,
    }

    await updatePmCal(id, pmCalData)
    updated++
    if (updated % 50 === 0) process.stdout.write(`\rUpdated ${updated}...`)
  }

  console.log(`\n\nDone! Updated ${updated} records. Not matched: ${notFound}`)
}

main().catch(err => { console.error('\nFailed:', err.message); process.exit(1) })
