import { NextRequest, NextResponse } from 'next/server'
import { requireSafetyEditor, requireSafetyManager, auditSafety } from '@/lib/lab-map/safety-access'
import { safetyAssetInputSchema, safetyAssetPatchSchema } from '@/lib/validations/lab-map-safety'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Context) {
  const body = await req.json().catch(() => null)
  const parsed = safetyAssetPatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  const guard = parsed.data.retire ? await requireSafetyManager() : await requireSafetyEditor()
  if (guard.response) return guard.response
  const { id } = await params
  const { data: current, error: loadError } = await supabaseAdmin.from('lab_map_safety_assets').select('*').eq('id', id).maybeSingle()
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!current) return NextResponse.json({ error: 'ไม่พบอุปกรณ์' }, { status: 404 })
  if (current.updated_at !== parsed.data.updatedAt) return NextResponse.json({ error: 'ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดใหม่' }, { status: 409 })

  const merged = safetyAssetInputSchema.safeParse({
    code: current.code,
    nameTh: parsed.data.nameTh ?? current.name_th,
    kind: parsed.data.kind ?? current.kind,
    shutoffFor: parsed.data.shutoffFor !== undefined ? parsed.data.shutoffFor : current.shutoff_for,
    x: parsed.data.x ?? Number(current.x), y: parsed.data.y ?? Number(current.y),
    spaceCode: parsed.data.spaceCode !== undefined ? parsed.data.spaceCode : current.space_code,
    department: parsed.data.department !== undefined ? parsed.data.department : current.department,
    sourceNoteTh: parsed.data.sourceNoteTh !== undefined ? parsed.data.sourceNoteTh : current.source_note_th,
  })
  if (!merged.success) return NextResponse.json({ error: merged.error.issues[0]?.message }, { status: 422 })
  const positionChanged = merged.data.x !== Number(current.x)
    || merged.data.y !== Number(current.y)
    || merged.data.spaceCode !== current.space_code
    || merged.data.kind !== current.kind
  const update = {
    name_th: merged.data.nameTh, kind: merged.data.kind, shutoff_for: merged.data.shutoffFor ?? null,
    x: merged.data.x, y: merged.data.y, space_code: merged.data.spaceCode ?? null,
    department: merged.data.department ?? null,
    source_note_th: merged.data.sourceNoteTh ?? null,
    lifecycle_status: parsed.data.retire ? 'retired' : current.lifecycle_status,
    ...(positionChanged ? { position_status: 'unverified', position_verified_by: null, position_verified_at: null } : {}),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabaseAdmin.from('lab_map_safety_assets').update(update)
    .eq('id', id).eq('updated_at', parsed.data.updatedAt).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดใหม่' }, { status: 409 })
  try { await auditSafety(parsed.data.retire ? 'lab_map.safety_asset.retire' : 'lab_map.safety_asset.update', guard.actor.id, id, update) }
  catch (auditError) { return NextResponse.json({ error: (auditError as Error).message }, { status: 500 }) }
  return NextResponse.json({ data })
}
