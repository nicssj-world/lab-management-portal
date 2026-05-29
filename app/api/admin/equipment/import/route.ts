import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const TEMPLATE_HEADERS = [
  'CBH Code', 'Hospital Asset No.', 'Department', 'Equipment Type',
  'Manufacturer', 'Model', 'Serial Number', 'Equipment Vendor',
  'Owner', 'Owner Status', 'Risk', 'Classification',
  'Purchase Date', 'Warranty Exp.', 'Purchase Price',
  'Status', 'ต้องการสอบเทียบ', 'ผู้รับผิดชอบ', 'Remark',
]

const TEMPLATE_EXAMPLE = [
  'CBH3367', '6515-047-0001/1/36', 'โลหิตวิทยา', 'BATH, WATER 24 ลิตร',
  'MEMMERT', 'W760', '92.0311', 'บ.ยูไนเต็ด อินทรูเมนท์ จำกัด',
  'รพ', 'Hospital', 'Medium', 'Diagnostic',
  '1993-09-17', '2025-12-31', '23320',
  'Active', 'ต้องการ', 'นาย ก ข ค', '',
]

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE])

  // Column widths
  ws['!cols'] = TEMPLATE_HEADERS.map((h, i) => ({
    wch: [12, 22, 18, 30, 16, 14, 18, 28, 6, 12, 8, 14, 14, 14, 14, 10, 16, 16, 20][i] ?? 16,
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Equipment')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="equipment-import-template.xlsx"',
    },
  })
}

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

function parseDate(value: unknown): string | null {
  if (!value) return null
  const s = String(value).trim()
  if (!s || s === '-' || s === 'n/a') return null
  // Excel serial date number
  const n = Number(s)
  if (!isNaN(n) && n > 1000) {
    const d = XLSX.SSF.parse_date_code(n)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  // Try direct parse
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return null
}

function parsePrice(value: unknown): number | null {
  if (!value) return null
  const s = String(value).replace(/,/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function parseBoolean(value: unknown): boolean {
  const s = String(value ?? '').trim().toLowerCase()
  return s === 'ต้องการ' || s === 'true' || s === 'yes' || s === '1'
}

// Column header → DB field mapping (flexible: tries multiple header names)
const COLUMN_MAP: Record<string, string> = {
  'cbh code': 'cbh_code',
  'cbhcode': 'cbh_code',
  'hospital asset no': 'hospital_asset_no',
  'hospital asset no.': 'hospital_asset_no',
  'asset no': 'hospital_asset_no',
  'department': 'department',
  'แผนก': 'department',
  'owner': 'owner',
  'เจ้าของ': 'owner',
  'owner status': 'owner_status',
  'risk': 'risk_level',
  'risk level': 'risk_level',
  'classification': 'classification',
  'equipment type': 'equipment_type',
  'ประเภทเครื่องมือ': 'equipment_type',
  'manufacturer': 'manufacturer',
  'model': 'model',
  'serial number': 'serial_number',
  'serial no': 'serial_number',
  'equipment vendor': 'vendor',
  'vendor': 'vendor',
  'purchase date': 'purchase_date',
  'warranty exp': 'warranty_exp',
  'warranty exp.': 'warranty_exp',
  'purchase price': 'purchase_price',
  'ราคา': 'purchase_price',
  'remark': 'remark',
  'หมายเหตุ': 'remark',
  'ผู้รับผิดชอบ': 'responsible_person',
  'responsible person': 'responsible_person',
  'ต้องการสอบเทียบ+pm ปี2569 หรือไม่': 'needs_calibration',
  'ต้องการสอบเทียบ': 'needs_calibration',
  'needs calibration': 'needs_calibration',
  // status column — last "status" column is equipment status
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const preview = formData.get('preview') === 'true'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 422 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]

  // Find header row (first row with meaningful content)
  const rawRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false, blankrows: false })

  // Find the row that looks like a header (contains 'Department' or 'Equipment Type' or 'CBH')
  let headerRowIdx = 0
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i]
    const combined = row.join('|').toLowerCase()
    if (combined.includes('department') || combined.includes('equipment type') || combined.includes('cbh')) {
      headerRowIdx = i
      break
    }
  }

  const headerRow = rawRows[headerRowIdx].map(h => String(h ?? '').trim().toLowerCase())
  const dataRows = rawRows.slice(headerRowIdx + 1)

  // Build column index map
  const colIdx: Record<string, number> = {}
  for (let i = 0; i < headerRow.length; i++) {
    const h = headerRow[i]
    if (!h) continue
    const dbField = COLUMN_MAP[h]
    if (dbField && !(dbField in colIdx)) {
      colIdx[dbField] = i
    }
  }
  // Last 'status' column (equipment status, not validation status)
  const statusCols = headerRow.reduce<number[]>((acc, h, i) => h === 'status' ? [...acc, i] : acc, [])
  if (statusCols.length > 0) colIdx['status'] = statusCols[statusCols.length - 1]

  const records: Record<string, unknown>[] = []
  for (const row of dataRows) {
    const eqType = String(row[colIdx['equipment_type'] ?? -1] ?? '').trim()
    if (!eqType || eqType.toLowerCase() === 'total' || eqType.toLowerCase() === 'grand total') continue

    const dept = String(row[colIdx['department'] ?? -1] ?? '').trim()
    if (!dept && !eqType) continue

    const record: Record<string, unknown> = {
      created_by: actor.id,
      equipment_type: eqType || 'ไม่ระบุ',
      department: dept || 'ไม่ระบุ',
    }

    const textFields = ['cbh_code', 'hospital_asset_no', 'owner', 'owner_status', 'risk_level',
      'classification', 'manufacturer', 'model', 'serial_number', 'vendor', 'remark', 'responsible_person']
    for (const f of textFields) {
      if (f in colIdx) {
        const val = String(row[colIdx[f]] ?? '').trim()
        record[f] = val || null
      }
    }

    if ('purchase_date' in colIdx) record['purchase_date'] = parseDate(row[colIdx['purchase_date']])
    if ('warranty_exp' in colIdx) record['warranty_exp'] = parseDate(row[colIdx['warranty_exp']])
    if ('purchase_price' in colIdx) record['purchase_price'] = parsePrice(row[colIdx['purchase_price']])
    if ('needs_calibration' in colIdx) record['needs_calibration'] = parseBoolean(row[colIdx['needs_calibration']])
    if ('status' in colIdx) {
      const s = String(row[colIdx['status']] ?? '').trim()
      const valid = ['Active', 'Inactive', 'ชำรุด', 'มาใหม่', 'ย้าย', 'สูญหาย']
      record['status'] = valid.includes(s) ? s : 'Active'
    }

    records.push(record)
  }

  if (preview) return NextResponse.json({ count: records.length, rows: records.slice(0, 5) })

  if (records.length === 0) return NextResponse.json({ error: 'ไม่พบข้อมูลที่นำเข้าได้' }, { status: 422 })

  // Batch insert 500 per chunk
  let inserted = 0
  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500)
    const { error } = await supabaseAdmin.from('equipment').insert(batch)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    inserted += batch.length
  }

  return NextResponse.json({ inserted })
}
