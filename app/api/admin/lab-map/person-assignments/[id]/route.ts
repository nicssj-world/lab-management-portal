import { NextRequest, NextResponse } from 'next/server'
import { requireResource } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { personAssignmentInputSchema } from '@/lib/lab-map/schemas'
import { auditMapPersonnel, requireActiveMapProfile, resolveAssignmentTarget } from '@/lib/lab-map/personnel-server'

type Context = { params: Promise<{ id: string }> }

async function getBefore(id: string) {
  const { data, error } = await supabaseAdmin.from('lab_map_person_assignments').select(
    'id,profile_id,assignment_type,space:lab_map_spaces(code),zone:lab_map_zones(code)',
  ).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const { actor, response } = await requireResource('บุคลากร', 'edit')
  if (!actor) return response
  const { id } = await params
  const parsed = personAssignmentInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })

  try {
    const before = await getBefore(id)
    if (!before) return NextResponse.json({ error: 'ไม่พบการกำหนดพื้นที่' }, { status: 404 })
    if (!(await requireActiveMapProfile(parsed.data.profileId))) {
      return NextResponse.json({ error: 'ไม่พบบุคลากรที่ใช้งานอยู่' }, { status: 404 })
    }
    const target = await resolveAssignmentTarget(parsed.data)
    if (!target) return NextResponse.json({ error: 'ไม่พบห้องหรือโซนในผังฉบับปัจจุบัน' }, { status: 404 })

    const { data, error } = await supabaseAdmin.from('lab_map_person_assignments').update({
      profile_id: parsed.data.profileId,
      assignment_type: parsed.data.assignmentType,
      space_id: target.space_id,
      zone_id: target.zone_id,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select('id,profile_id,space_id,zone_id,assignment_type,created_at,updated_at').single()
    if (error?.code === '23505') return NextResponse.json({ error: 'มีการกำหนดพื้นที่นี้แล้ว' }, { status: 409 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await auditMapPersonnel('lab_map.person_assignment.update', actor.id, id, {
      profileId: parsed.data.profileId,
      before: {
        assignmentType: before.assignment_type,
        targetCode: ((before.space as unknown as { code?: string } | null)?.code
          ?? (before.zone as unknown as { code?: string } | null)?.code ?? null),
      },
      after: { assignmentType: parsed.data.assignmentType, targetCode: target.targetCode },
    })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { actor, response } = await requireResource('บุคลากร', 'edit')
  if (!actor) return response
  const { id } = await params
  try {
    const before = await getBefore(id)
    if (!before) return NextResponse.json({ error: 'ไม่พบการกำหนดพื้นที่' }, { status: 404 })
    const { error } = await supabaseAdmin.from('lab_map_person_assignments').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await auditMapPersonnel('lab_map.person_assignment.delete', actor.id, id, {
      profileId: before.profile_id,
      assignmentType: before.assignment_type,
      targetCode: ((before.space as unknown as { code?: string } | null)?.code
        ?? (before.zone as unknown as { code?: string } | null)?.code ?? null),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ลบไม่สำเร็จ' }, { status: 500 })
  }
}
