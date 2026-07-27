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

// เปลี่ยนได้เฉพาะชื่อและสถานะเปิด/ปิดใช้งาน — ไม่แตะ kind/parent_code/has_geometry
// (โครงสร้าง/รูปทรงมาจาก lib/equipment-map/manifest.ts เท่านั้น)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { code } = await params
  const body = await req.json()
  const update: Record<string, unknown> = { updated_by: actor.id, updated_at: new Date().toISOString() }
  if (typeof body.nameTh === 'string' && body.nameTh.trim()) update.name_th = body.nameTh.trim()
  if (typeof body.isActive === 'boolean') update.is_active = body.isActive

  const { data, error } = await supabaseAdmin
    .from('equipment_areas')
    .update(update)
    .eq('code', code)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  supabaseAdmin.from('audit_log').insert({
    action: 'equipment.area.update',
    user_id: actor.id,
    target: code,
    detail: data.name_th,
  }).then(undefined, () => {})
  return NextResponse.json(data)
}
