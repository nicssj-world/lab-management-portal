import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditVerification, canManageVerification, jsonDatabaseError, requireItVerification } from '@/lib/it-verification/guard'
import { sectionMapSchema, assigneeSchema } from '@/lib/it-verification/validation'
import { departmentCodeForProfileDepartment, IT_DEPARTMENTS } from '@/lib/it-verification/domain'

export async function GET() {
  const guard = await requireItVerification('view')
  if ('error' in guard) return guard.error
  if (!canManageVerification(guard.actor)) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ IT เท่านั้นที่ดูหน้าตั้งค่าได้' }, { status: 403 })
  const [mappingRes, peopleRes] = await Promise.all([
    supabaseAdmin.from('it_verification_section_map').select('id, source_lab_section, department_id, is_active').order('source_lab_section'),
    supabaseAdmin.from('profiles').select('id, name, dept').eq('status', 'active').is('deleted_at', null).order('name'),
  ])
  const error = mappingRes.error ?? peopleRes.error
  if (error) return jsonDatabaseError(error)
  return NextResponse.json({ mappings: mappingRes.data ?? [], departments: IT_DEPARTMENTS, profiles: peopleRes.data ?? [] })
}

export async function PATCH(request: NextRequest) {
  const guard = await requireItVerification('view')
  if ('error' in guard) return guard.error
  if (!canManageVerification(guard.actor)) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ IT เท่านั้นที่แก้ mapping ได้' }, { status: 403 })
  const parsed = sectionMapSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูล mapping ไม่ถูกต้อง' }, { status: 422 })
  if (!IT_DEPARTMENTS.some((department) => department.id === parsed.data.departmentId)) {
    return NextResponse.json({ error: 'หน่วยงานนี้ไม่อยู่ในขอบเขตการทวนสอบ IT' }, { status: 422 })
  }
  const { data, error } = await supabaseAdmin.from('it_verification_section_map').upsert({
    source_lab_section: parsed.data.sourceLabSection,
    department_id: parsed.data.departmentId,
    is_active: parsed.data.isActive,
    updated_at: new Date().toISOString(),
    created_by: guard.actor.id,
  }, { onConflict: 'source_lab_section' }).select().single()
  if (error) return jsonDatabaseError(error)
  await auditVerification('mapping.update', guard.actor.id, data.id, parsed.data.sourceLabSection)
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const guard = await requireItVerification('view')
  if ('error' in guard) return guard.error
  if (!canManageVerification(guard.actor)) return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ IT เท่านั้นที่มอบหมายผู้รับผิดชอบได้' }, { status: 403 })
  const parsed = assigneeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลผู้รับผิดชอบไม่ถูกต้อง' }, { status: 422 })
  const { data: profile } = await supabaseAdmin.from('profiles').select('id, name, dept').eq('id', parsed.data.profileId).eq('status', 'active').is('deleted_at', null).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'ไม่พบบุคลากรที่ยังปฏิบัติงานอยู่' }, { status: 422 })
  const department = IT_DEPARTMENTS.find((item) => item.id === parsed.data.departmentId)
  if (!department || departmentCodeForProfileDepartment(profile.dept) !== department.code) {
    return NextResponse.json({ error: 'ผู้รับผิดชอบต้องอยู่ในหน่วยงานเดียวกับ sample' }, { status: 422 })
  }
  const { data: round, error: roundError } = await supabaseAdmin
    .from('it_verification_rounds').select('id, department_id, status').eq('id', parsed.data.roundId).maybeSingle()
  if (roundError) return jsonDatabaseError(roundError)
  if (!round) return NextResponse.json({ error: 'ไม่พบรอบการทวนสอบ' }, { status: 404 })
  if (round.department_id !== parsed.data.departmentId) return NextResponse.json({ error: 'หน่วยงานไม่ตรงกับรอบการทวนสอบ' }, { status: 422 })
  if (round.status === 'reviewed') return NextResponse.json({ error: 'รอบนี้ถูกล็อกแล้ว ไม่สามารถเปลี่ยนผู้รับผิดชอบได้' }, { status: 409 })
  const { data, error } = await supabaseAdmin.from('it_verification_assignees').upsert({
    round_id: parsed.data.roundId,
    department_id: parsed.data.departmentId,
    profile_id: parsed.data.profileId,
    assigned_by: guard.actor.id,
  }, { onConflict: 'round_id,department_id' }).select().single()
  if (error) return jsonDatabaseError(error)
  await auditVerification('assignee.update', guard.actor.id, data.id, `round=${parsed.data.roundId}; profile=${profile.name}`)
  return NextResponse.json(data)
}
