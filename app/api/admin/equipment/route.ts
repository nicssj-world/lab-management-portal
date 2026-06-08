import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100

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

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const all = searchParams.get('all') === '1' || searchParams.get('all') === 'true'
  const page = parsePositiveInt(searchParams.get('page'), 1)
  const requestedPageSize = parsePositiveInt(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE)
  const pageSize = all ? requestedPageSize : Math.min(requestedPageSize, MAX_PAGE_SIZE)
  const sortDir = searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc'

  let query: any = supabaseAdmin
    .from('equipment')
    .select('*', { count: all ? undefined : 'exact' })
    .order('equipment_type', { ascending: sortDir === 'asc' })
    .order('item_no', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  query = applyEquipmentFilters(query, searchParams)
  if (!all) {
    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const total = all ? (data?.length ?? 0) : (count ?? 0)
  const { data: statusRows } = await supabaseAdmin.from('equipment').select('status')
  const statusCounts = (statusRows ?? []).reduce<Record<string, number>>((acc, row) => {
    const statusValue = (row as { status: string | null }).status ?? ''
    acc[''] = (acc[''] ?? 0) + 1
    acc[statusValue] = (acc[statusValue] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    items: data ?? [],
    count: total,
    page,
    pageSize,
    totalPages: all ? 1 : Math.max(1, Math.ceil(total / pageSize)),
    statusCounts,
  })
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (body.cbh_code !== undefined && body.cbh_code?.trim() === '') body.cbh_code = null
  if (body.hospital_asset_no !== undefined && body.hospital_asset_no?.trim() === '') body.hospital_asset_no = null
  const { data, error } = await supabaseAdmin
    .from('equipment')
    .insert({ ...body, created_by: actor.id })
    .select()
    .single()

  if (error) {
    if (error.code === '23505' && error.message.includes('cbh_code'))
      return NextResponse.json({ error: 'รหัส CBH นี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
