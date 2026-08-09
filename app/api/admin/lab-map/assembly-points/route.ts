import { NextRequest, NextResponse } from 'next/server'
import { auditSafety, requireSafetyEditor, requireSafetyViewer } from '@/lib/lab-map/safety-access'
import { listAssemblyPoints } from '@/lib/lab-map/safety-server'
import { assemblyPointInputSchema } from '@/lib/validations/lab-map-safety'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const guard = await requireSafetyViewer()
  if (guard.response) return guard.response
  try {
    return NextResponse.json({ items: await listAssemblyPoints(req.nextUrl.searchParams.get('includeRetired') === '1') })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const parsed = assemblyPointInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  const value = parsed.data
  const { data, error } = await supabaseAdmin.from('lab_map_assembly_points').insert({
    code: value.code, name_th: value.nameTh, detail_th: value.detailTh ?? null, point_type: value.pointType,
    latitude: value.latitude ?? null, longitude: value.longitude ?? null, created_by: guard.actor.id,
  }).select('*').single()
  if (error?.code === '23505') return NextResponse.json({ error: 'รหัสจุดรวมพลซ้ำ' }, { status: 409 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { error: exitError } = value.exitCodes.length
    ? await supabaseAdmin.from('lab_map_assembly_point_exits').insert(
      value.exitCodes.map(exitCode => ({ assembly_point_id: data.id, exit_code: exitCode })),
    )
    : { error: null }
  if (exitError) {
    await supabaseAdmin.from('lab_map_assembly_points').delete().eq('id', data.id)
    return NextResponse.json({ error: exitError.message }, { status: 422 })
  }
  try { await auditSafety('lab_map.assembly_point.create', guard.actor.id, data.id, { code: data.code }) }
  catch (auditError) { return NextResponse.json({ error: (auditError as Error).message }, { status: 500 }) }
  return NextResponse.json({ data }, { status: 201 })
}
