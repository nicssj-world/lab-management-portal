import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPermissionsWithEquipmentOverride } from '@/lib/permissions'
import { getLabCodeInfo } from '@/lib/equipment-lab-code'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const TEMPLATE_HEADERS = [
  'LAB Code', 'Hospital Asset No.', 'Department', 'Equipment Type',
  'Manufacturer', 'Model', 'Serial Number', 'Equipment Vendor',
  'Owner', 'Owner Status', 'Risk', 'Classification',
  'Purchase Date', 'Warranty Exp.', 'Purchase Price',
  'Status', 'ต้องการสอบเทียบ', 'ผู้รับผิดชอบ', 'Remark',
]

const TEMPLATE_EXAMPLE = [
  'LAB-CC-02-001', '6515-047-0001/1/36', 'โลหิตวิทยา', 'BATH, WATER 24 ลิตร',
  'MEMMERT', 'W760', '92.0311', 'บ.ยูไนเต็ด อินทรูเมนท์ จำกัด',
  'Hospital', 'Hospital', 'Medium', 'Centrifuge',
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
  return s === 'ต้องการ' || s === 'รอขึ้นทะเบียน' || s === 'true' || s === 'yes' || s === '1'
}

// Column header → DB field mapping (flexible: tries multiple header names)
const COLUMN_MAP: Record<string, string> = {
  'lab code': 'cbh_code',
  'labcode': 'cbh_code',
  'รหัส lab': 'cbh_code',
  'รหัสเครื่องมือ lab': 'cbh_code',
  'รอรหัส lab': 'cbh_code_pending',
  'รอขึ้นทะเบียน lab': 'cbh_code_pending',
  'รอขึ้นทะเบียนรหัส lab': 'cbh_code_pending',
  'cbh code': 'cbh_code',
  'cbhcode': 'cbh_code',
  'hospital asset no': 'hospital_asset_no',
  'hospital asset no.': 'hospital_asset_no',
  'asset no': 'hospital_asset_no',
  'รอเลขสินทรัพย์': 'hospital_asset_no_pending',
  'รอขึ้นทะเบียนเลขสินทรัพย์': 'hospital_asset_no_pending',
  'รอขึ้นทะเบียนสินทรัพย์': 'hospital_asset_no_pending',
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

type ImportRecord = Record<string, unknown> & {
  __rowNumber: number
  equipment_type: string
  department: string
}

type ExistingEquipment = {
  id: string
  cbh_code: string | null
  hospital_asset_no: string | null
  serial_number: string | null
  equipment_type: string
  department: string
}

type ResponsibleUser = {
  id: string
  ephis_id: string | null
  name: string
}

type DuplicateIssue = {
  row: number
  field: string
  value: string
  equipment_type: string
  department: string
  source: 'database' | 'file'
  matched_with: string
}

type DuplicateRow = {
  row: number
  equipment_type: string
  department: string
  action: 'insert' | 'update' | 'blocked'
  target: string | null
  canImport: boolean
  reason: string | null
  issues: DuplicateIssue[]
}

type ImportPlan = {
  row: number
  action: 'insert' | 'update' | 'blocked'
  targetId: string | null
  target: string | null
  reason: string | null
}

const DUPLICATE_FIELDS: { key: 'cbh_code' | 'hospital_asset_no' | 'serial_number'; label: string }[] = [
  { key: 'cbh_code', label: 'LAB Code' },
  { key: 'hospital_asset_no', label: 'Hospital Asset No' },
  { key: 'serial_number', label: 'Serial Number' },
]

const PLACEHOLDER_VALUES = new Set(['-', '--', '–', '—', 'n/a', 'na', 'none', 'null', '-'])

function normalizeKey(value: unknown) {
  const s = String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  return PLACEHOLDER_VALUES.has(s) ? '' : s
}

function displayEquipment(eq: ExistingEquipment) {
  const parts = [eq.equipment_type, eq.department]
  if (eq.cbh_code) parts.push(eq.cbh_code)
  if (eq.hospital_asset_no) parts.push(eq.hospital_asset_no)
  if (eq.serial_number) parts.push(`SN: ${eq.serial_number}`)
  return parts.join(' · ')
}

function rowDisplay(row: ImportRecord) {
  const parts = [`แถว ${row.__rowNumber}`, row.equipment_type, row.department]
  const cbh = String(row.cbh_code ?? '').trim()
  const asset = String(row.hospital_asset_no ?? '').trim()
  const serial = String(row.serial_number ?? '').trim()
  if (cbh) parts.push(cbh)
  if (asset) parts.push(asset)
  if (serial) parts.push(`SN: ${serial}`)
  return parts.join(' · ')
}

function fallbackKey(row: Pick<ImportRecord, 'equipment_type' | 'department'>) {
  const type = normalizeKey(row.equipment_type)
  const dept = normalizeKey(row.department)
  return type && dept ? `${type}|${dept}` : ''
}

function hasStrongIdentity(row: Record<string, unknown>) {
  return DUPLICATE_FIELDS.some(({ key }) => !!normalizeKey(row[key]))
}

async function getExistingEquipment(): Promise<ExistingEquipment[]> {
  const rows: ExistingEquipment[] = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('equipment')
      .select('id, cbh_code, hospital_asset_no, serial_number, equipment_type, department')
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as ExistingEquipment[]))
    if (!data || data.length < pageSize) break
  }

  return rows
}

async function getResponsibleUsers(): Promise<ResponsibleUser[]> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, ephis_id, name')
    .eq('status', 'active')
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  return (data ?? []) as ResponsibleUser[]
}

function findResponsibleUser(value: unknown, users: ResponsibleUser[]): ResponsibleUser | null {
  const key = normalizeKey(value)
  if (!key) return null

  const byEphis = users.filter(user => normalizeKey(user.ephis_id) === key)
  if (byEphis.length === 1) return byEphis[0]

  const byName = users.filter(user => normalizeKey(user.name) === key)
  if (byName.length === 1) return byName[0]

  // Partial: every word in the input must appear as a word in the user's full name
  // e.g. "สมชาย" or "ใจดี" matches "นาย สมชาย ใจดี"
  const keyTokens = key.split(/\s+/).filter(Boolean)
  const byPartial = users.filter(user => {
    const userTokens = normalizeKey(user.name).split(/\s+/)
    return keyTokens.every(kt => userTokens.includes(kt))
  })
  if (byPartial.length === 1) return byPartial[0]

  return null
}

function addToMap<T>(map: Map<string, T[]>, key: string, value: T) {
  if (!key) return
  const list = map.get(key) ?? []
  list.push(value)
  map.set(key, list)
}

async function findDuplicateIssues(records: ImportRecord[], existing = [] as ExistingEquipment[]): Promise<DuplicateIssue[]> {
  if (existing.length === 0) existing = await getExistingEquipment()
  const existingByField = new Map<string, ExistingEquipment[]>()
  const fileByField = new Map<string, ImportRecord[]>()
  const existingByFallback = new Map<string, ExistingEquipment[]>()
  const fileByFallback = new Map<string, ImportRecord[]>()

  for (const eq of existing) {
    for (const { key } of DUPLICATE_FIELDS) addToMap(existingByField, `${key}:${normalizeKey(eq[key])}`, eq)
    addToMap(existingByFallback, fallbackKey(eq), eq)
  }

  for (const row of records) {
    for (const { key } of DUPLICATE_FIELDS) addToMap(fileByField, `${key}:${normalizeKey(row[key])}`, row)
    if (!hasStrongIdentity(row)) addToMap(fileByFallback, fallbackKey(row), row)
  }

  const issues: DuplicateIssue[] = []
  const seen = new Set<string>()
  const pushIssue = (issue: DuplicateIssue) => {
    const key = `${issue.row}|${issue.field}|${issue.value}|${issue.source}|${issue.matched_with}`
    if (seen.has(key)) return
    seen.add(key)
    issues.push(issue)
  }

  for (const row of records) {
    for (const { key, label } of DUPLICATE_FIELDS) {
      const value = normalizeKey(row[key])
      if (!value) continue

      for (const eq of existingByField.get(`${key}:${value}`) ?? []) {
        pushIssue({
          row: row.__rowNumber,
          field: label,
          value: String(row[key] ?? '').trim(),
          equipment_type: row.equipment_type,
          department: row.department,
          source: 'database',
          matched_with: displayEquipment(eq),
        })
      }

      const sameFileRows = (fileByField.get(`${key}:${value}`) ?? []).filter(other => other.__rowNumber !== row.__rowNumber)
      if (sameFileRows.length > 0) {
        pushIssue({
          row: row.__rowNumber,
          field: label,
          value: String(row[key] ?? '').trim(),
          equipment_type: row.equipment_type,
          department: row.department,
          source: 'file',
          matched_with: sameFileRows.map(rowDisplay).join(' | '),
        })
      }
    }

    if (!hasStrongIdentity(row)) {
      const key = fallbackKey(row)
      if (!key) continue

      for (const eq of existingByFallback.get(key) ?? []) {
        pushIssue({
          row: row.__rowNumber,
          field: 'Equipment Type + Department',
          value: `${row.equipment_type} / ${row.department}`,
          equipment_type: row.equipment_type,
          department: row.department,
          source: 'database',
          matched_with: displayEquipment(eq),
        })
      }

      const sameFileRows = (fileByFallback.get(key) ?? []).filter(other => other.__rowNumber !== row.__rowNumber)
      if (sameFileRows.length > 0) {
        pushIssue({
          row: row.__rowNumber,
          field: 'Equipment Type + Department',
          value: `${row.equipment_type} / ${row.department}`,
          equipment_type: row.equipment_type,
          department: row.department,
          source: 'file',
          matched_with: sameFileRows.map(rowDisplay).join(' | '),
        })
      }
    }
  }

  return issues.sort((a, b) => a.row - b.row || a.field.localeCompare(b.field))
}

function uniqueMatch(
  map: Map<string, ExistingEquipment[]>,
  key: string,
  fieldLabel: string,
): { eq: ExistingEquipment | null; reason: string | null } {
  if (!key) return { eq: null, reason: null }
  const matches = map.get(key) ?? []
  if (matches.length === 0) return { eq: null, reason: null }
  if (matches.length === 1) return { eq: matches[0], reason: null }
  return { eq: null, reason: `${fieldLabel} นี้ตรงกับเครื่องมือในระบบมากกว่า 1 รายการ` }
}

function buildImportPlans(records: ImportRecord[], existing: ExistingEquipment[]): ImportPlan[] {
  const byAsset = new Map<string, ExistingEquipment[]>()
  const bySerial = new Map<string, ExistingEquipment[]>()
  const byLabCode = new Map<string, ExistingEquipment[]>()

  for (const eq of existing) {
    addToMap(byAsset, normalizeKey(eq.hospital_asset_no), eq)
    addToMap(bySerial, normalizeKey(eq.serial_number), eq)
    addToMap(byLabCode, normalizeKey(eq.cbh_code), eq)
  }

  const plans: ImportPlan[] = records.map((record) => {
    const assetKey = normalizeKey(record.hospital_asset_no)
    const serialKey = normalizeKey(record.serial_number)
    const labCodeKey = normalizeKey(record.cbh_code)

    const assetMatch = uniqueMatch(byAsset, assetKey, 'Hospital Asset No')
    const serialMatch = uniqueMatch(bySerial, serialKey, 'Serial Number')
    if (assetMatch.reason || serialMatch.reason) {
      return {
        row: record.__rowNumber,
        action: 'blocked',
        targetId: null,
        target: null,
        reason: assetMatch.reason ?? serialMatch.reason,
      }
    }

    const candidates = [assetMatch.eq, serialMatch.eq].filter(Boolean) as ExistingEquipment[]
    const target = candidates[0] ?? null
    if (target && candidates.some(eq => eq.id !== target.id)) {
      return {
        row: record.__rowNumber,
        action: 'blocked',
        targetId: null,
        target: null,
        reason: 'Hospital Asset No และ Serial Number ตรงกับคนละเครื่องในระบบ',
      }
    }

    const labMatches = byLabCode.get(labCodeKey) ?? []
    if (labCodeKey && labMatches.some(eq => eq.id !== target?.id)) {
      return {
        row: record.__rowNumber,
        action: 'blocked',
        targetId: null,
        target: null,
        reason: 'LAB Code ซ้ำกับเครื่องมืออื่นในระบบ',
      }
    }

    if (target) {
      return {
        row: record.__rowNumber,
        action: 'update',
        targetId: target.id,
        target: displayEquipment(target),
        reason: null,
      }
    }

    return {
      row: record.__rowNumber,
      action: 'insert',
      targetId: null,
      target: null,
      reason: null,
    }
  })

  const targetCounts = new Map<string, number>()
  for (const plan of plans) {
    if (plan.action === 'update' && plan.targetId) {
      targetCounts.set(plan.targetId, (targetCounts.get(plan.targetId) ?? 0) + 1)
    }
  }

  return plans.map(plan => {
    if (plan.action === 'update' && plan.targetId && (targetCounts.get(plan.targetId) ?? 0) > 1) {
      return {
        ...plan,
        action: 'blocked' as const,
        reason: 'ไฟล์นี้มีหลายแถวที่ตรงกับเครื่องมือเดียวกันในระบบ',
      }
    }
    return plan
  })
}

function buildDuplicateRows(duplicates: DuplicateIssue[], plans = [] as ImportPlan[]): DuplicateRow[] {
  const byRow = new Map<number, DuplicateIssue[]>()
  const planByRow = new Map(plans.map(plan => [plan.row, plan]))
  for (const issue of duplicates) {
    const list = byRow.get(issue.row) ?? []
    list.push(issue)
    byRow.set(issue.row, list)
  }

  return Array.from(byRow.entries())
    .map(([row, issues]) => {
      const first = issues[0]
      const plan = planByRow.get(row)
      const labFileDuplicate = issues.some(issue => issue.field === 'LAB Code' && issue.source === 'file')
      const hardBlock = plan?.action === 'blocked'
        || labFileDuplicate
        || issues.some(issue => issue.field === 'LAB Code' && issue.source === 'database' && plan?.action !== 'update')
      return {
        row,
        equipment_type: first.equipment_type,
        department: first.department,
        action: plan?.action ?? 'insert',
        target: plan?.target ?? null,
        canImport: !hardBlock,
        reason: plan?.reason ?? (labFileDuplicate ? 'LAB Code ซ้ำในไฟล์ ต้องข้ามหรือแก้รหัสก่อน' : hardBlock ? 'LAB Code ซ้ำกับข้อมูลในระบบ ต้องข้ามหรือแก้รหัสก่อน' : null),
        issues,
      }
    })
    .sort((a, b) => a.row - b.row)
}

function toInsertRecord(record: ImportRecord) {
  const { __rowNumber, ...insertable } = record
  void __rowNumber
  return insertable
}

function toUpdateRecord(record: ImportRecord) {
  const { __rowNumber, created_by, ...updateable } = record
  void __rowNumber
  void created_by
  const cleaned = Object.fromEntries(
    Object.entries(updateable).filter(([, value]) => value !== null && value !== undefined && value !== ''),
  )
  if (record.cbh_code_pending === true) cleaned.cbh_code = null
  else cleaned.cbh_code = String(record.cbh_code ?? '').trim() || null
  if (record.hospital_asset_no_pending === true) cleaned.hospital_asset_no = null
  return cleaned
}

function parseSkipRows(value: FormDataEntryValue | null) {
  if (!value || typeof value !== 'string') return new Set<number>()
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return new Set<number>()
    return new Set(parsed.map(Number).filter(n => Number.isInteger(n) && n > 0))
  } catch {
    return new Set<number>()
  }
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const preview = formData.get('preview') === 'true'
  const skipRows = parseSkipRows(formData.get('skip_rows'))

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
    if (combined.includes('department') || combined.includes('equipment type') || combined.includes('lab code') || combined.includes('cbh')) {
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

  const responsibleUsers = await getResponsibleUsers()
  const records: ImportRecord[] = []
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const eqType = String(row[colIdx['equipment_type'] ?? -1] ?? '').trim()
    if (!eqType || eqType.toLowerCase() === 'total' || eqType.toLowerCase() === 'grand total') continue

    const labCode = String(row[colIdx['cbh_code'] ?? -1] ?? '').trim()
    const dept = String(row[colIdx['department'] ?? -1] ?? '').trim()
    const labInfo = getLabCodeInfo(labCode)
    if (!dept && !eqType) continue

    const record: ImportRecord = {
      __rowNumber: headerRowIdx + i + 2,
      created_by: actor.id,
      equipment_type: eqType || 'ไม่ระบุ',
      department: dept || labInfo.department || 'ไม่ระบุ',
    }

    const textFields = ['cbh_code', 'hospital_asset_no', 'owner', 'owner_status', 'risk_level',
      'classification', 'manufacturer', 'model', 'serial_number', 'vendor', 'remark', 'responsible_person']
    for (const f of textFields) {
      if (f in colIdx) {
        const val = String(row[colIdx[f]] ?? '').trim()
        record[f] = val || null
      }
    }
    if ('cbh_code_pending' in colIdx) record['cbh_code_pending'] = parseBoolean(row[colIdx['cbh_code_pending']])
    if ('hospital_asset_no_pending' in colIdx) record['hospital_asset_no_pending'] = parseBoolean(row[colIdx['hospital_asset_no_pending']])
    if (String(record['cbh_code'] ?? '').trim() === 'รอขึ้นทะเบียน') {
      record['cbh_code_pending'] = true
      record['cbh_code'] = null
    }
    if (String(record['hospital_asset_no'] ?? '').trim() === 'รอขึ้นทะเบียน') {
      record['hospital_asset_no_pending'] = true
      record['hospital_asset_no'] = null
    }
    if (record['cbh_code_pending'] === true) record['cbh_code'] = null
    else if (record['cbh_code']) record['cbh_code_pending'] = false
    if (record['hospital_asset_no_pending'] === true) record['hospital_asset_no'] = null
    else if (record['hospital_asset_no']) record['hospital_asset_no_pending'] = false
    const responsibleUser = findResponsibleUser(record['responsible_person'], responsibleUsers)
    if (responsibleUser) {
      record['responsible_user_id'] = responsibleUser.id
      record['responsible_person'] = responsibleUser.name
    }
    if (labInfo.classification) record['classification'] = labInfo.classification

    if ('purchase_date' in colIdx) record['purchase_date'] = parseDate(row[colIdx['purchase_date']])
    if ('warranty_exp' in colIdx) record['warranty_exp'] = parseDate(row[colIdx['warranty_exp']])
    if ('purchase_price' in colIdx) record['purchase_price'] = parsePrice(row[colIdx['purchase_price']])
    if ('needs_calibration' in colIdx) record['needs_calibration'] = parseBoolean(row[colIdx['needs_calibration']])
    if ('status' in colIdx) {
      const s = String(row[colIdx['status']] ?? '').trim()
      const valid = ['Active', 'Inactive', 'ชำรุด', 'มาใหม่', 'ย้าย', 'สูญหาย']
      record['status'] = valid.includes(s) ? s : 'Active'
    }
    if (record['status'] === 'Inactive') record['needs_calibration'] = false

    records.push(record)
  }

  if (records.length === 0) return NextResponse.json({ error: 'ไม่พบข้อมูลที่นำเข้าได้' }, { status: 422 })

  if (preview) {
    const existing = await getExistingEquipment()
    const plans = buildImportPlans(records, existing)
    const duplicates = await findDuplicateIssues(records, existing)
    const duplicateRows = buildDuplicateRows(duplicates, plans)
    const insertCount = plans.filter(plan => plan.action === 'insert').length
    const updateCount = plans.filter(plan => plan.action === 'update').length
    const blockedCount = plans.filter(plan => plan.action === 'blocked').length
    return NextResponse.json({
      count: records.length,
      rows: records.slice(0, 5).map(toInsertRecord),
      insertCount,
      updateCount,
      blockedCount,
      plans,
      duplicateCount: duplicates.length,
      duplicates: duplicates.slice(0, 50),
      duplicateRows,
    })
  }

  const selectedRecords = records.filter(record => !skipRows.has(record.__rowNumber))
  if (selectedRecords.length === 0) {
    return NextResponse.json({ error: 'ไม่มีรายการที่เลือกให้นำเข้า' }, { status: 422 })
  }

  const selectedExisting = await getExistingEquipment()
  const selectedPlans = buildImportPlans(selectedRecords, selectedExisting)
  const selectedDuplicates = await findDuplicateIssues(selectedRecords, selectedExisting)
  const selectedDuplicateRows = buildDuplicateRows(selectedDuplicates, selectedPlans)
  const blockedRows = selectedDuplicateRows.filter(row => !row.canImport)
  if (blockedRows.length > 0) {
    return NextResponse.json({
      error: `ยังมีรายการที่นำเข้าไม่ได้ ${blockedRows.length} แถว กรุณาเลือกข้ามหรือแก้ไฟล์ก่อนนำเข้า`,
      duplicateCount: blockedRows.length,
      duplicates: selectedDuplicates.slice(0, 50),
      duplicateRows: blockedRows,
    }, { status: 409 })
  }

  let inserted = 0
  let updated = 0
  const planByRow = new Map(selectedPlans.map(plan => [plan.row, plan]))
  const insertRecords = selectedRecords.filter(record => planByRow.get(record.__rowNumber)?.action === 'insert')
  const updateRecords = selectedRecords.filter(record => planByRow.get(record.__rowNumber)?.action === 'update')

  for (const record of updateRecords) {
    const plan = planByRow.get(record.__rowNumber)
    if (!plan?.targetId) continue
    const { error } = await supabaseAdmin
      .from('equipment')
      .update(toUpdateRecord(record))
      .eq('id', plan.targetId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    updated += 1
  }

  for (let i = 0; i < insertRecords.length; i += 500) {
    const batch = insertRecords.slice(i, i + 500).map(toInsertRecord)
    const { error } = await supabaseAdmin.from('equipment').insert(batch)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    inserted += batch.length
  }

  return NextResponse.json({ inserted, updated })
}
