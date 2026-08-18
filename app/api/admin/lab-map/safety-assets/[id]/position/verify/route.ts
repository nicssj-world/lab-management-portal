import { NextRequest, NextResponse } from 'next/server'
import { requireSafetyEditor } from '@/lib/lab-map/safety-access'
import { safetyAssetPositionVerificationSchema } from '@/lib/validations/lab-map-safety'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Context = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Context) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const parsed = safetyAssetPositionVerificationSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  const { id } = await params

  const { data: current, error: loadError } = await supabaseAdmin.from('lab_map_safety_assets')
    .select('id,position_status,updated_at').eq('id', id).eq('lifecycle_status', 'active').maybeSingle()
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!current) return NextResponse.json({ error: 'ไม่พบอุปกรณ์ที่ใช้งานอยู่' }, { status: 404 })
  if (current.updated_at !== parsed.data.updatedAt) {
    return NextResponse.json({ error: 'ข้อมูลอุปกรณ์ถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดใหม่' }, { status: 409 })
  }

  const verifiedAt = new Date().toISOString()
  const update = {
    position_status: 'verified',
    position_verified_by: guard.actor.id,
    position_verified_at: verifiedAt,
    updated_at: verifiedAt,
  }
  const { data, error } = await supabaseAdmin.from('lab_map_safety_assets').update(update)
    .eq('id', id).eq('updated_at', parsed.data.updatedAt)
    .select('id,position_status,position_verified_by,position_verified_at,updated_at').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'ข้อมูลอุปกรณ์ถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดใหม่' }, { status: 409 })

  return NextResponse.json({
    data: {
      id: String(data.id), positionStatus: data.position_status,
      positionVerifiedBy: String(data.position_verified_by), positionVerifiedAt: String(data.position_verified_at),
      updatedAt: String(data.updated_at),
    },
  })
}
