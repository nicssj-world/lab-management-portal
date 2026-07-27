import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPermissionsWithEquipmentOverride } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') === 'none')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('equipment_areas')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// สร้าง "พื้นที่นอกผัง" เท่านั้น (เช่น คลังชั้นอื่นที่ไม่มีในแผนที่) — has_geometry เป็น false เสมอ
// ห้ามสร้างพื้นที่ที่มีรูปทรงจากตรงนี้ ต้อง author ใน lib/equipment-map/manifest.ts เท่านั้น
export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const nameTh = typeof body.nameTh === 'string' ? body.nameTh.trim() : ''
  if (!code || !nameTh) return NextResponse.json({ error: 'กรุณาระบุรหัสและชื่อพื้นที่' }, { status: 422 })

  const { data: maxSort } = await supabaseAdmin
    .from('equipment_areas')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabaseAdmin
    .from('equipment_areas')
    .insert({
      code,
      kind: 'room',
      parent_code: null,
      name_th: nameTh,
      has_geometry: false,
      sort_order: (maxSort?.sort_order ?? 0) + 1,
      updated_by: actor.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'มีรหัสพื้นที่นี้อยู่แล้ว กรุณาใช้รหัสอื่น' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  supabaseAdmin.from('audit_log').insert({
    action: 'equipment.area.create',
    user_id: actor.id,
    target: code,
    detail: nameTh,
  }).then(undefined, () => {})
  return NextResponse.json(data, { status: 201 })
}
