import { NextRequest, NextResponse } from 'next/server'
import { requireResource } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { personAssignmentInputSchema } from '@/lib/lab-map/schemas'
import { auditMapPersonnel, requireActiveMapProfile, resolveAssignmentTarget } from '@/lib/lab-map/personnel-server'

export async function POST(request: NextRequest) {
  const { actor, response } = await requireResource('บุคลากร', 'edit')
  if (!actor) return response
  const parsed = personAssignmentInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })

  try {
    if (!(await requireActiveMapProfile(parsed.data.profileId))) {
      return NextResponse.json({ error: 'ไม่พบบุคลากรที่ใช้งานอยู่' }, { status: 404 })
    }
    const target = await resolveAssignmentTarget(parsed.data)
    if (!target) return NextResponse.json({ error: 'ไม่พบห้องหรือโซนในผังฉบับปัจจุบัน' }, { status: 404 })

    const { data, error } = await supabaseAdmin.from('lab_map_person_assignments').insert({
      profile_id: parsed.data.profileId,
      assignment_type: parsed.data.assignmentType,
      space_id: target.space_id,
      zone_id: target.zone_id,
    }).select('id,profile_id,space_id,zone_id,assignment_type,created_at,updated_at').single()
    if (error?.code === '23505') return NextResponse.json({ error: 'มีการกำหนดพื้นที่นี้แล้ว' }, { status: 409 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await auditMapPersonnel('lab_map.person_assignment.create', actor.id, data.id, {
      profileId: parsed.data.profileId,
      assignmentType: parsed.data.assignmentType,
      targetCode: target.targetCode,
    })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }
}
