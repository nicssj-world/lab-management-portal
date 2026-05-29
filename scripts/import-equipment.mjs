// Run: node scripts/import-equipment.mjs
import XLSX from 'xlsx'

const SUPABASE_URL = 'https://fslagsuorkcckvvtrmyi.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGFnc3VvcmtjY2t2dnRybXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTE4MDc1OSwiZXhwIjoyMDk0NzU2NzU5fQ.6OwSnEAaMWpwQ52QaubLxIHDcqRVE-pj0qJWNGaFYdY'

// Sheets to process (skip summary/graph sheets)
const DEPT_SHEETS = [
  'โลหิตวิทยา', 'เคมีคลินิก', 'ภูมิคุ้มกัน', 'อณูชีววิทยา',
  'จุลทรรศน์', 'คลังเลือด', 'ผู้ป่วยนอก', 'ส่งตรวจต่อ',
  'ศสม', 'คลังน้ำยา', 'ไม่มีเจ้าของ', 'จุลชีววิทยา',
]

const VALID_STATUS = ['Active', 'Inactive', 'ชำรุด', 'มาใหม่', 'ย้าย', 'สูญหาย']
const VALID_RISK   = ['High', 'Medium', 'Low']

// Column indices in header row (row 1, 0-indexed)
// 0=Status(validation), 1=needs_cal, 2=owner, 3=item_no, 4=department,
// 5=hospital_asset_no, 6=risk, 7=cbh_code, 8=classification, 9=equipment_type,
// 10=manufacturer, 11=model, 12=serial_number, 13=vendor, 14=owner_status,
// 15=purchase_date, 16=warranty_exp, 17=purchase_price, 18=status(equip), 19=remark
const COL = {
  needs_cal: 1, owner: 2, item_no: 3, department: 4,
  hospital_asset_no: 5, risk: 6, cbh_code: 7, classification: 8,
  equipment_type: 9, manufacturer: 10, model: 11, serial_number: 12,
  vendor: 13, owner_status: 14, purchase_date: 15, warranty_exp: 16,
  purchase_price: 17, status: 18, remark: 19,
}

function cell(row, idx) {
  if (idx < 0 || idx >= row.length) return ''
  return String(row[idx] ?? '').trim()
}

// Thai 2-digit year: 2500 + yy then -543 for CE
// e.g. "36" → 2536 BE → 1993 CE, "60" → 2560 BE → 2017 CE
function thaiShortYearToCE(y2) {
  const be = 2500 + parseInt(y2)
  return be - 543
}

function makeISODate(y, m, d) {
  if (y < 1900 || y > 2100) return null
  if (m < 1 || m > 12) return null
  if (d < 1 || d > 31) return null
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

function parseDate(v) {
  const s = String(v ?? '').trim()
  if (!s || s === '-' || s.toLowerCase() === 'n/a') return null
  if (/ปี|เดือน|วัน|year|month/i.test(s)) return null

  // X/X/YY — 2-digit Buddhist year (Thai short)
  const short2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (short2) {
    const a = parseInt(short2[1]), b = parseInt(short2[2])
    const ce = thaiShortYearToCE(short2[3])
    // Determine MM/DD vs DD/MM: if a > 12, it's DD; if b > 12, it's MM(first)
    if (a > 12) return makeISODate(ce, b, a)   // DD/MM/YY
    if (b > 12) return makeISODate(ce, a, b)   // MM/DD/YY
    // Ambiguous: prefer DD/MM (Thai standard)
    return makeISODate(ce, b, a)
  }

  // X/X/YYYY — 4-digit year (Buddhist or CE)
  const long4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (long4) {
    const a = parseInt(long4[1]), b = parseInt(long4[2])
    const rawY = parseInt(long4[3])
    const ce = rawY > 2400 ? rawY - 543 : rawY
    if (a > 12) return makeISODate(ce, b, a)
    if (b > 12) return makeISODate(ce, a, b)
    return makeISODate(ce, b, a)
  }

  // Excel serial number
  const n = Number(s.replace(/,/g,''))
  if (!isNaN(n) && Number.isInteger(n) && n > 1 && n < 60000) {
    const d = XLSX.SSF.parse_date_code(n)
    if (d && d.y >= 1900 && d.y <= 2100)
      return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }

  // 4-digit year only e.g. "2536" Buddhist or "1993" CE
  if (/^\d{4}$/.test(s)) {
    const y = parseInt(s)
    const ce = y > 2400 ? y - 543 : y
    if (ce >= 1900 && ce <= 2100) return `${ce}-01-01`
  }

  return null
}

function parsePrice(v) {
  const s = String(v ?? '').replace(/,/g,'').replace(/\s/g,'').trim()
  if (!s || s === '-' || s === 'n/a') return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
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
  const wb = XLSX.readFile('data/equipment-import-source.xlsx')
  const all = []
  const seenCbh = new Set()

  for (const sheetName of DEPT_SHEETS) {
    const ws = wb.Sheets[sheetName]
    if (!ws) { console.log(`Sheet "${sheetName}" not found, skipping`); continue }

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false })

    // Find data start: skip rows that don't have a valid item_no (number) in col 3
    let dataStart = 2
    for (let i = 1; i < Math.min(rows.length, 6); i++) {
      const itemVal = cell(rows[i], COL.item_no)
      if (!isNaN(parseInt(itemVal)) && parseInt(itemVal) >= 1) {
        dataStart = i
        break
      }
    }

    let count = 0
    for (let i = dataStart; i < rows.length; i++) {
      const row = rows[i]
      const eqType = cell(row, COL.equipment_type)
      const dept   = cell(row, COL.department)

      // Skip blank, sub-header, or total rows
      if (!eqType) continue
      if (eqType.toLowerCase().includes('total') || eqType === 'Equipment Type') continue
      const itemNo = parseInt(cell(row, COL.item_no))
      if (isNaN(itemNo) || itemNo < 1) continue

      const cbhCode = cell(row, COL.cbh_code) || null
      // Skip duplicate CBH codes
      if (cbhCode && cbhCode !== '-') {
        if (seenCbh.has(cbhCode)) continue
        seenCbh.add(cbhCode)
      }

      const riskRaw = cell(row, COL.risk)
      const statusRaw = cell(row, COL.status)
      const needsCalRaw = cell(row, COL.needs_cal).toLowerCase()

      const rec = {
        item_no:            isNaN(itemNo) ? null : itemNo,
        cbh_code:           (cbhCode && cbhCode !== '-') ? cbhCode : null,
        hospital_asset_no:  cell(row, COL.hospital_asset_no) || null,
        department:         dept || sheetName,
        owner:              cell(row, COL.owner) || null,
        owner_status:       cell(row, COL.owner_status) || null,
        risk_level:         VALID_RISK.includes(riskRaw) ? riskRaw : null,
        classification:     cell(row, COL.classification) || null,
        equipment_type:     eqType,
        manufacturer:       cell(row, COL.manufacturer) || null,
        model:              cell(row, COL.model) || null,
        serial_number:      cell(row, COL.serial_number) || null,
        vendor:             cell(row, COL.vendor) || null,
        purchase_date:      parseDate(cell(row, COL.purchase_date)),
        warranty_exp:       parseDate(cell(row, COL.warranty_exp)),
        purchase_price:     parsePrice(cell(row, COL.purchase_price)),
        status:             VALID_STATUS.includes(statusRaw) ? statusRaw : 'Active',
        needs_calibration:  needsCalRaw === 'ต้องการ' || needsCalRaw === 'true',
        remark:             cell(row, COL.remark) || null,
      }

      all.push(rec)
      count++
    }
    console.log(`  ${sheetName}: ${count} records`)
  }

  console.log(`\nTotal records to insert: ${all.length}`)
  if (all.length === 0) { console.log('Nothing to insert.'); return }

  // Insert in batches of 100
  let inserted = 0
  for (let i = 0; i < all.length; i += 100) {
    const batch = all.slice(i, i + 100)
    await supabaseInsert(batch)
    inserted += batch.length
    process.stdout.write(`\rInserted ${inserted}/${all.length}...`)
  }
  console.log(`\n\nDone! Inserted ${inserted} equipment records.`)
}

main().catch(err => { console.error('\nFailed:', err.message); process.exit(1) })
