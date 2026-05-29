import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const search = searchParams.get('search') ?? ''
  const department = searchParams.get('department') ?? ''
  const status = searchParams.get('status') ?? ''
  const risk_level = searchParams.get('risk_level') ?? ''
  const needs_calibration = searchParams.get('needs_calibration')

  let query = supabaseAdmin
    .from('equipment')
    .select('*')
    .order('item_no', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (search) {
    query = query.or(
      `equipment_type.ilike.%${search}%,cbh_code.ilike.%${search}%,hospital_asset_no.ilike.%${search}%,serial_number.ilike.%${search}%,manufacturer.ilike.%${search}%,model.ilike.%${search}%,responsible_person.ilike.%${search}%`
    )
  }
  if (department) query = query.eq('department', department)
  if (status) query = query.eq('status', status)
  if (risk_level) query = query.eq('risk_level', risk_level)
  if (needs_calibration === 'true') query = query.eq('needs_calibration', true)
  if (needs_calibration === 'false') query = query.eq('needs_calibration', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('equipment')
    .insert({ ...body, created_by: actor.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
