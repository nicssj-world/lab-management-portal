import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPermissionsWithEquipmentOverride } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const EXPORT_HEADERS = [
  'LAB Code', 'Hospital Asset No.', 'Department', 'Equipment Type',
  'Manufacturer', 'Model', 'Serial Number', 'Equipment Vendor',
  'Owner', 'Owner Status', 'Risk', 'Classification',
  'Purchase Date', 'Warranty Exp.', 'Purchase Price',
  'Status', 'ต้องการสอบเทียบ', 'ผู้รับผิดชอบ', 'Remark',
]

const COL_WIDTHS = [12, 22, 18, 30, 16, 14, 18, 28, 10, 12, 8, 14, 14, 14, 14, 10, 16, 20, 24]

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

function applyFilters(query: ReturnType<typeof supabaseAdmin.from>, searchParams: URLSearchParams) {
  const search = (searchParams.get('search') ?? '').trim().replace(/[(),]/g, ' ')
  const department = searchParams.get('department') ?? ''
  const status = searchParams.get('status') ?? ''
  const risk_level = searchParams.get('risk_level') ?? ''
  const needs_calibration = searchParams.get('needs_calibration')
  const pending_reg = searchParams.get('pending_reg')

  if (search) {
    const pattern = `%${escapeLike(search)}%`
    query = query.or([
      `equipment_type.ilike.${pattern}`,
      `cbh_code.ilike.${pattern}`,
      `hospital_asset_no.ilike.${pattern}`,
      `serial_number.ilike.${pattern}`,
      `manufacturer.ilike.${pattern}`,
      `model.ilike.${pattern}`,
      `responsible_person.ilike.${pattern}`,
    ].join(','))
  }
  if (department) query = query.eq('department', department)
  if (status) query = query.eq('status', status)
  if (risk_level) query = query.eq('risk_level', risk_level)
  if (needs_calibration === 'true') query = query.eq('needs_calibration', true)
  if (needs_calibration === 'false') query = query.eq('needs_calibration', false)
  if (pending_reg === 'true') query = query.or('cbh_code_pending.eq.true,hospital_asset_no_pending.eq.true')

  return query
}

function formatDate(value: string | null): string {
  if (!value) return ''
  try {
    const [y, m, d] = value.slice(0, 10).split('-')
    return `${d}/${m}/${y}`
  } catch {
    return value
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const perms = await getPermissionsWithEquipmentOverride(profile.role, profile.id)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') === 'none')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const sortDir = searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc'
  const sortBy = searchParams.get('sortBy') === 'code' ? 'cbh_code' : 'equipment_type'

  let query = supabaseAdmin
    .from('equipment')
    .select('cbh_code, cbh_code_pending, hospital_asset_no, hospital_asset_no_pending, department, equipment_type, manufacturer, model, serial_number, vendor, owner, owner_status, risk_level, classification, purchase_date, warranty_exp, purchase_price, status, needs_calibration, responsible_person, remark')
    .order(sortBy, { ascending: sortDir === 'asc', nullsFirst: false })
    .order(sortBy === 'cbh_code' ? 'equipment_type' : 'cbh_code', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  query = applyFilters(query, searchParams)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map(eq => [
    eq.cbh_code_pending ? 'รอขึ้นทะเบียน' : (eq.cbh_code ?? ''),
    eq.hospital_asset_no_pending ? 'รอขึ้นทะเบียน' : (eq.hospital_asset_no ?? ''),
    eq.department ?? '',
    eq.equipment_type ?? '',
    eq.manufacturer ?? '',
    eq.model ?? '',
    eq.serial_number ?? '',
    eq.vendor ?? '',
    eq.owner ?? '',
    eq.owner_status ?? '',
    eq.risk_level ?? '',
    eq.classification ?? '',
    formatDate(eq.purchase_date),
    formatDate(eq.warranty_exp),
    eq.purchase_price != null ? eq.purchase_price : '',
    eq.status ?? '',
    eq.needs_calibration ? 'ต้องการ' : 'ไม่ต้องการ',
    eq.responsible_person ?? '',
    eq.remark ?? '',
  ])

  const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...rows])
  ws['!cols'] = COL_WIDTHS.map(wch => ({ wch }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Equipment')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="equipment-${today}.xlsx"`,
    },
  })
}
