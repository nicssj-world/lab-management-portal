import { NextRequest, NextResponse } from 'next/server'
import { auditSafety, requireSafetyEditor, requireSafetyManager } from '@/lib/lab-map/safety-access'
import { assemblyPointInputSchema, assemblyPointPatchSchema } from '@/lib/validations/lab-map-safety'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Context) {
  const parsed = assemblyPointPatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  const guard = parsed.data.retire ? await requireSafetyManager() : await requireSafetyEditor()
  if (guard.response) return guard.response
  const { id } = await params
  const [{ data: current, error }, { data: exits }] = await Promise.all([
    supabaseAdmin.from('lab_map_assembly_points').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('lab_map_assembly_point_exits').select('exit_code').eq('assembly_point_id', id),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!current) return NextResponse.json({ error: 'ไม่พบจุดรวมพล' }, { status: 404 })
  if (current.updated_at !== parsed.data.updatedAt) return NextResponse.json({ error: 'ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดใหม่' }, { status: 409 })
  const currentExits = (exits ?? []).map(row => row.exit_code as string).toSorted()
  const merged = assemblyPointInputSchema.safeParse({
    code: current.code, nameTh: parsed.data.nameTh ?? current.name_th,
    detailTh: parsed.data.detailTh !== undefined ? parsed.data.detailTh : current.detail_th,
    pointType: parsed.data.pointType ?? (current.point_type === 'safe' ? 'safe' : 'assembly'),
    latitude: parsed.data.latitude !== undefined ? parsed.data.latitude : current.latitude == null ? null : Number(current.latitude),
    longitude: parsed.data.longitude !== undefined ? parsed.data.longitude : current.longitude == null ? null : Number(current.longitude),
    exitCodes: parsed.data.exitCodes ?? currentExits,
  })
  if (!merged.success) return NextResponse.json({ error: merged.error.issues[0]?.message }, { status: 422 })
  const nextExits = [...new Set(merged.data.exitCodes)].toSorted()
  const currentLatitude = current.latitude == null ? null : Number(current.latitude)
  const currentLongitude = current.longitude == null ? null : Number(current.longitude)
  const positionChanged = currentLatitude !== merged.data.latitude
    || currentLongitude !== merged.data.longitude
    || currentExits.join('|') !== nextExits.join('|')
  const update = {
    name_th: merged.data.nameTh, detail_th: merged.data.detailTh ?? null,
    point_type: merged.data.pointType,
    latitude: merged.data.latitude ?? null, longitude: merged.data.longitude ?? null,
    lifecycle_status: parsed.data.retire ? 'retired' : current.lifecycle_status,
    ...(positionChanged ? { position_status: 'unverified', position_verified_by: null, position_verified_at: null } : {}),
    updated_at: new Date().toISOString(),
  }
  const { data, error: updateError } = await supabaseAdmin.from('lab_map_assembly_points').update(update)
    .eq('id', id).eq('updated_at', parsed.data.updatedAt).select('*').maybeSingle()
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดใหม่' }, { status: 409 })
  if (parsed.data.exitCodes) {
    const { error: deleteError } = await supabaseAdmin.from('lab_map_assembly_point_exits').delete().eq('assembly_point_id', id)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
    const { error: insertError } = nextExits.length
      ? await supabaseAdmin.from('lab_map_assembly_point_exits').insert(
        nextExits.map(exitCode => ({ assembly_point_id: id, exit_code: exitCode })),
      )
      : { error: null }
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 422 })
  }
  try { await auditSafety(parsed.data.retire ? 'lab_map.assembly_point.retire' : 'lab_map.assembly_point.update', guard.actor.id, id, update) }
  catch (auditError) { return NextResponse.json({ error: (auditError as Error).message }, { status: 500 }) }
  return NextResponse.json({ data })
}
