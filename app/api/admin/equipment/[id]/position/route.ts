import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPermissionsWithEquipmentOverride } from '@/lib/permissions'
import { EQUIPMENT_AREAS } from '@/lib/equipment-map/manifest'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

const areaDefByCode = new Map(EQUIPMENT_AREAS.map((area) => [area.code, area]))

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const areaCode: string | null = body.areaCode ?? null
  const x: number | null = body.x ?? null
  const y: number | null = body.y ?? null
  const rotation: number | null = body.rotation ?? null

  if (areaCode === null && (x !== null || y !== null)) {
    return NextResponse.json({ error: 'ต้องระบุพื้นที่ก่อนจึงจะปักหมุดได้' }, { status: 422 })
  }
  if ((x === null) !== (y === null)) {
    return NextResponse.json({ error: 'ต้องระบุพิกัด x และ y พร้อมกัน' }, { status: 422 })
  }
  if (rotation !== null && ![0, 90, 180, 270].includes(rotation)) {
    return NextResponse.json({ error: 'มุมสัญลักษณ์ต้องเป็น 0, 90, 180 หรือ 270 องศา' }, { status: 422 })
  }

  if (areaCode !== null) {
    const { data: areaRow, error: areaError } = await supabaseAdmin
      .from('equipment_areas')
      .select('code, has_geometry, is_active')
      .eq('code', areaCode)
      .maybeSingle()
    if (areaError) return NextResponse.json({ error: areaError.message }, { status: 500 })
    if (!areaRow || !areaRow.is_active) {
      return NextResponse.json({ error: 'ไม่พบพื้นที่นี้ในระบบ หรือพื้นที่ถูกปิดใช้งาน' }, { status: 422 })
    }
    if (x !== null && y !== null) {
      if (!areaRow.has_geometry) {
        return NextResponse.json({ error: 'พื้นที่นี้ไม่มีตำแหน่งบนแผนที่ ปักหมุดไม่ได้' }, { status: 422 })
      }
      const box = areaDefByCode.get(areaCode)?.rect
      if (!box || x < box.x || x > box.x + box.width || y < box.y || y > box.y + box.height) {
        return NextResponse.json({ error: 'พิกัดที่ระบุอยู่นอกขอบเขตของพื้นที่นี้' }, { status: 422 })
      }
    }
  }

  const update = {
    area_code: areaCode,
    map_x: x,
    map_y: y,
    position_set_by: areaCode === null ? null : actor.id,
    position_set_at: areaCode === null ? null : new Date().toISOString(),
    ...(rotation !== null ? { map_rotation: rotation } : {}),
  }

  const { data, error } = await supabaseAdmin
    .from('equipment')
    .update(update)
    .eq('id', id)
    .select('id, cbh_code, equipment_type, area_code, map_x, map_y, map_rotation')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
