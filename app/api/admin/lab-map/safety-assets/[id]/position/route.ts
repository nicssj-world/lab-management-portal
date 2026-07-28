import { NextRequest, NextResponse } from 'next/server'
import { requireSafetyEditor } from '@/lib/lab-map/safety-access'
import { safetyAssetPositionSchema } from '@/lib/validations/lab-map-safety'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Context) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const parsed = safetyAssetPositionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  const { id } = await params

  const { data: current, error: loadError } = await supabaseAdmin.from('lab_map_safety_assets')
    .select('id,x,y,space_code,updated_at').eq('id', id).eq('lifecycle_status', 'active').maybeSingle()
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!current) return NextResponse.json({ error: 'ไม่พบอุปกรณ์ที่ใช้งานอยู่' }, { status: 404 })
  if (current.updated_at !== parsed.data.updatedAt) {
    return NextResponse.json({ error: 'ตำแหน่งถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดใหม่' }, { status: 409 })
  }

  if (parsed.data.spaceCode) {
    const { data: space, error: spaceError } = await supabaseAdmin.from('lab_map_spaces')
      .select('code').eq('code', parsed.data.spaceCode).eq('is_active', true).maybeSingle()
    if (spaceError) return NextResponse.json({ error: spaceError.message }, { status: 500 })
    if (!space) return NextResponse.json({ error: 'ไม่พบห้องที่เลือกหรือห้องถูกปิดใช้งานแล้ว' }, { status: 422 })
  }

  const updatedAt = new Date().toISOString()
  const update = {
    x: parsed.data.x,
    y: parsed.data.y,
    space_code: parsed.data.spaceCode,
    position_status: 'unverified',
    position_verified_by: null,
    position_verified_at: null,
    updated_at: updatedAt,
  }
  const { data, error } = await supabaseAdmin.from('lab_map_safety_assets').update(update)
    .eq('id', id).eq('updated_at', parsed.data.updatedAt)
    .select('id,x,y,space_code,position_status,updated_at').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'ตำแหน่งถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดใหม่' }, { status: 409 })

  const responseData = {
    id: String(data.id), x: Number(data.x), y: Number(data.y),
    spaceCode: data.space_code as string | null,
    positionStatus: data.position_status,
    updatedAt: String(data.updated_at),
  }

  return NextResponse.json({ data: responseData })
}
