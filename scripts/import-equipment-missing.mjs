// Import missing equipment records from the new combined sheet
// Run: node scripts/import-equipment-missing.mjs
import XLSX from 'xlsx'

const SUPABASE_URL = 'https://fslagsuorkcckvvtrmyi.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGFnc3VvcmtjY2t2dnRybXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTE4MDc1OSwiZXhwIjoyMDk0NzU2NzU5fQ.6OwSnEAaMWpwQ52QaubLxIHDcqRVE-pj0qJWNGaFYdY'

const VALID_RISK = ['High', 'Medium', 'Low']

// Column positions in "รวมงาน (2)" sheet
const COL = {
  needs_cal: 1, owner: 2, item_no: 3, department: 4,
  hospital_asset_no: 5, risk: 6, cbh_code: 7, classification: 8,
  equipment_type: 9, manufacturer: 10, model: 11,
  serial_number: 12, vendor: 13,
  // Note: no purchase_date/warranty_exp/price/status/remark in this combined sheet
}

function cell(row, idx) {
  return String(row[idx] ?? '').trim()
}

async function getExistingRecords() {
  let page = 0
  const cbhSet = new Set()
  const serialSet = new Set()
  const typeDepSet = new Set() // fallback key: equipment_type|department

  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/equipment?select=cbh_code,serial_number,equipment_type,department&limit=1000&offset=${page * 1000}`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    )
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) break
    for (const r of rows) {
      if (r.cbh_code && r.cbh_code !== '-') cbhSet.add(r.cbh_code.trim())
      if (r.serial_number && r.serial_number !== '-') serialSet.add(r.serial_number.trim())
      if (!r.cbh_code && r.equipment_type && r.department)
        typeDepSet.add(`${r.equipment_type.trim()}|${r.department.trim()}`)
    }
    if (rows.length < 1000) break
    page++
  }
  return { cbhSet, serialSet, typeDepSet }
}

async function supabaseInsert(records) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/equipment`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(records),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HTTP ${res.status}: ${err}`)
  }
}

async function main() {
  console.log('Loading existing records from DB...')
  const { cbhSet, serialSet, typeDepSet } = await getExistingRecords()
  console.log(`DB has: ${cbhSet.size} unique CBH codes, ${serialSet.size} serial numbers, ${typeDepSet.size} type+dept keys\n`)

  const wb = XLSX.readFile('data/equipment-new.xlsx')
  const ws = wb.Sheets['รวมงาน (2)']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false })

  // Header is row 1, data starts row 2
  const toInsert = []
  const seenCbhInSheet = new Set()
  const seenTypeDepInSheet = new Set() // dedup no-CBH records within sheet
  let skippedDB = 0, skippedDupSheet = 0, skippedBlank = 0

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i]
    const eqType = cell(row, COL.equipment_type)
    if (!eqType || eqType.toLowerCase().includes('total') || eqType === 'Equipment Type') {
      skippedBlank++
      continue
    }

    const dept     = cell(row, COL.department)
    const cbhRaw   = cell(row, COL.cbh_code)
    const cbh      = (cbhRaw && cbhRaw !== '-' && cbhRaw !== 'ไม่มี' && cbhRaw !== 'รอขอ') ? cbhRaw : null
    const serial   = cell(row, COL.serial_number) || null
    const riskRaw  = cell(row, COL.risk)

    // Dedup within sheet
    if (cbh) {
      if (seenCbhInSheet.has(cbh)) { skippedDupSheet++; continue }
      seenCbhInSheet.add(cbh)
    } else if (serial && serial !== '-') {
      // Has serial → dedup by serial (unique machine identifier)
      if (seenTypeDepInSheet.has(`SN:${serial}`)) { skippedDupSheet++; continue }
      seenTypeDepInSheet.add(`SN:${serial}`)
    } else {
      // No CBH, no serial → dedup by type+dept (no other way to distinguish)
      const typeDepKey = `TD:${eqType}|${dept}`
      if (seenTypeDepInSheet.has(typeDepKey)) { skippedDupSheet++; continue }
      seenTypeDepInSheet.add(typeDepKey)
    }

    // Check already in DB
    if (cbh && cbhSet.has(cbh)) { skippedDB++; continue }
    if (!cbh && serial && serial !== '-' && serialSet.has(serial)) { skippedDB++; continue }
    // No CBH, no serial → check type+dept in DB
    if (!cbh && (!serial || serial === '-') && typeDepSet.has(`${eqType}|${dept}`)) { skippedDB++; continue }

    toInsert.push({
      cbh_code:          cbh,
      hospital_asset_no: cell(row, COL.hospital_asset_no) || null,
      department:        dept || 'ไม่ระบุ',
      owner:             cell(row, COL.owner) || null,
      risk_level:        VALID_RISK.includes(riskRaw) ? riskRaw : null,
      classification:    cell(row, COL.classification) || null,
      equipment_type:    eqType,
      manufacturer:      cell(row, COL.manufacturer) || null,
      model:             cell(row, COL.model) || null,
      serial_number:     serial,
      vendor:            cell(row, COL.vendor) || null,
      needs_calibration: cell(row, COL.needs_cal).toLowerCase() === 'ต้องการ',
      status:            'Active',
    })
  }

  console.log(`Skipped (already in DB): ${skippedDB}`)
  console.log(`Skipped (dup CBH in sheet): ${skippedDupSheet}`)
  console.log(`Skipped (blank/total): ${skippedBlank}`)
  console.log(`New records to insert: ${toInsert.length}\n`)

  if (toInsert.length === 0) { console.log('Nothing new to insert.'); return }

  // Show sample
  console.log('Sample records:')
  toInsert.slice(0, 3).forEach(r => console.log(' -', r.cbh_code ?? '(no CBH)', '|', r.department, '|', r.equipment_type.substring(0, 50)))
  console.log('')

  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100)
    await supabaseInsert(batch)
    inserted += batch.length
    process.stdout.write(`\rInserted ${inserted}/${toInsert.length}...`)
  }
  console.log(`\n\nDone! Inserted ${inserted} new records.`)
  console.log(`Total in DB should now be: ${cbhSet.size + inserted} (approx)`)
}

main().catch(err => { console.error('\nFailed:', err.message); process.exit(1) })
