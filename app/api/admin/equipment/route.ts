import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPermissionsWithEquipmentOverride } from '@/lib/permissions'
import { getLabCodeInfo } from '@/lib/equipment-lab-code'
import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100

type EquipmentSummaryCounts = {
  active: number
  highRisk: number
  warrantyAlert: number
  needsCalibration: number
}

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

function normalizeSearch(value: string) {
  return value.trim().replace(/[(),]/g, ' ')
}

function isWarrantyAlert(exp: string | null) {
  if (!exp) return false
  const days = (new Date(exp).getTime() - Date.now()) / 86400000
  return days < 90
}

function summarizeEquipmentRows(rows: Array<{ status: string | null; risk_level: string | null; needs_calibration: boolean | null; warranty_exp: string | null }>) {
  return rows.reduce<EquipmentSummaryCounts>((acc, row) => {
    if (row.status === 'Active') acc.active += 1
    if (row.risk_level === 'High') acc.highRisk += 1
    if (row.needs_calibration) acc.needsCalibration += 1
    if (isWarrantyAlert(row.warranty_exp)) acc.warrantyAlert += 1
    return acc
  }, { active: 0, highRisk: 0, warrantyAlert: 0, needsCalibration: 0 })
}

function normalizePendingRegistration(body: Record<string, any>) {
  const labCode = String(body.cbh_code ?? '').trim()
  const assetNo = String(body.hospital_asset_no ?? '').trim()

  if (body.cbh_code_pending === true || labCode === 'รอขึ้นทะเบียน') {
    body.cbh_code_pending = true
    body.cbh_code = null
  } else if (body.cbh_code !== undefined) {
    body.cbh_code = labCode || null
    if (body.cbh_code) body.cbh_code_pending = false
  }

  if (body.hospital_asset_no_pending === true || assetNo === 'รอขึ้นทะเบียน') {
    body.hospital_asset_no_pending = true
    body.hospital_asset_no = null
  } else if (body.hospital_asset_no !== undefined) {
    body.hospital_asset_no = assetNo || null
    if (body.hospital_asset_no) body.hospital_asset_no_pending = false
  }
}

async function applyResponsibleUser(body: Record<string, any>) {
  if (body.responsible_user_id === '') body.responsible_user_id = null
  if (body.responsible_user_id === undefined || body.responsible_user_id === null) return null

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name')
    .eq('id', body.responsible_user_id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return 'ไม่พบผู้รับผิดชอบในฐานผู้ใช้งาน'
  body.responsible_person = data.name
  return null
}

function applyEquipmentFilters(query: any, searchParams: URLSearchParams) {
  const search = normalizeSearch(searchParams.get('search') ?? '')
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

async function getDuplicateEquipmentIds(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('equipment')
    .select('id, serial_number, hospital_asset_no')

  const snCounts = new Map<string, number>()
  const assetCounts = new Map<string, number>()
  for (const row of (data ?? []) as { id: string; serial_number: string | null; hospital_asset_no: string | null }[]) {
    const sn = row.serial_number?.trim()
    const asset = row.hospital_asset_no?.trim()
    if (sn && /\d/.test(sn)) snCounts.set(sn, (snCounts.get(sn) ?? 0) + 1)
    if (asset && /\d/.test(asset)) assetCounts.set(asset, (assetCounts.get(asset) ?? 0) + 1)
  }

  const dupSNs = new Set([...snCounts.entries()].filter(([, c]) => c > 1).map(([sn]) => sn))
  const dupAssets = new Set([...assetCounts.entries()].filter(([, c]) => c > 1).map(([a]) => a))

  return (data ?? [])
    .filter((row: any) => {
      const sn = row.serial_number?.trim()
      const asset = row.hospital_asset_no?.trim()
      return (sn && dupSNs.has(sn)) || (asset && dupAssets.has(asset))
    })
    .map((row: any) => row.id as string)
}

export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') === 'none')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const all = searchParams.get('all') === '1' || searchParams.get('all') === 'true'
  const page = parsePositiveInt(searchParams.get('page'), 1)
  const requestedPageSize = parsePositiveInt(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE)
  const pageSize = all ? requestedPageSize : Math.min(requestedPageSize, MAX_PAGE_SIZE)
  const sortDir = searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc'
  const sortBy = searchParams.get('sortBy') === 'code' ? 'code' : 'name'

  // Resolve duplicate S/N + Asset No filter before building main query
  let duplicateIds: string[] | null = null
  if (searchParams.get('duplicate_sn') === 'true') {
    duplicateIds = await getDuplicateEquipmentIds()
    if (duplicateIds.length === 0) {
      return NextResponse.json({ items: [], count: 0, page: 1, pageSize, totalPages: 1, statusCounts: {}, summaryCounts: { active: 0, highRisk: 0, warrantyAlert: 0, needsCalibration: 0 } })
    }
  }

  let query: any = supabaseAdmin
    .from('equipment')
    .select('*', { count: all ? undefined : 'exact' })
    .order(sortBy === 'code' ? 'cbh_code' : 'equipment_type', { ascending: sortDir === 'asc', nullsFirst: false })
    .order(sortBy === 'code' ? 'equipment_type' : 'cbh_code', { ascending: true, nullsFirst: false })
    .order('item_no', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  query = applyEquipmentFilters(query, searchParams)
  if (duplicateIds) query = query.in('id', duplicateIds)
  if (!all) {
    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const total = all ? (data?.length ?? 0) : (count ?? 0)
  const { data: statusRows } = await supabaseAdmin.from('equipment').select('status')
  let summaryQuery: any = supabaseAdmin
    .from('equipment')
    .select('status, risk_level, needs_calibration, warranty_exp')
  summaryQuery = applyEquipmentFilters(summaryQuery, searchParams)
  const { data: summaryRows, error: summaryError } = await summaryQuery
  if (summaryError) return NextResponse.json({ error: summaryError.message }, { status: 500 })
  const statusCounts = (statusRows ?? []).reduce<Record<string, number>>((acc, row) => {
    const statusValue = (row as { status: string | null }).status ?? ''
    acc[''] = (acc[''] ?? 0) + 1
    acc[statusValue] = (acc[statusValue] ?? 0) + 1
    return acc
  }, {})
  const summaryCounts = summarizeEquipmentRows(summaryRows ?? [])

  return NextResponse.json({
    items: data ?? [],
    count: total,
    page,
    pageSize,
    totalPages: all ? 1 : Math.max(1, Math.ceil(total / pageSize)),
    statusCounts,
    summaryCounts,
  })
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  normalizePendingRegistration(body)
  const responsibleError = await applyResponsibleUser(body)
  if (responsibleError) return NextResponse.json({ error: responsibleError }, { status: 422 })
  const labInfo = getLabCodeInfo(body.cbh_code)
  if (labInfo.department) body.department = labInfo.department
  if (labInfo.classification) body.classification = labInfo.classification
  if (body.status === 'Inactive') body.needs_calibration = false
  const { data, error } = await supabaseAdmin
    .from('equipment')
    .insert({ ...body, created_by: actor.id })
    .select()
    .single()

  if (error) {
    if (error.code === '23505' && error.message.includes('cbh_code'))
      return NextResponse.json({ error: 'รหัส LAB นี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  supabaseAdmin.from('audit_log').insert({
    action: 'equipment.create',
    user_id: actor.id,
    target: data.cbh_code ?? data.equipment_type,
    detail: `${data.equipment_type}${data.cbh_code ? ' · ' + data.cbh_code : ''}`,
  }).then(undefined, () => {})
  return NextResponse.json(data, { status: 201 })
}
