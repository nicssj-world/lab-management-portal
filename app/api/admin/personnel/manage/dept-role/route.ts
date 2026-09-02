import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePersonnelManage } from '@/lib/auth/guards'
import { DEPARTMENTS } from '@/lib/validations/user-schema'

const Schema = z.object({
  profileId: z.string().uuid(),
  dept: z.enum(DEPARTMENTS).nullable().optional(),
  teamOrgVisible: z.boolean().optional(),
  deptRole: z.enum(['group_lead', 'group_deputy']).nullable().optional(),
  isSectionHead: z.boolean().optional(),
})

// Set a person's placement in the group org chart. Admin/Manager only.
// Either field may be sent independently (group role and หัวหน้างาน are separate).
export async function PATCH(req: NextRequest) {
  const { actor, response } = await requirePersonnelManage()
  if (!actor) return response
  const parsed = Schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }
  const { profileId, dept, teamOrgVisible, deptRole, isSectionHead } = parsed.data
  const patch: Record<string, unknown> = {}
  if (dept !== undefined) patch.dept = dept
  if (teamOrgVisible !== undefined) patch.team_org_visible = teamOrgVisible
  if (deptRole !== undefined) patch.dept_role = deptRole
  if (isSectionHead !== undefined) patch.is_section_head = isSectionHead
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'ไม่มีข้อมูลให้แก้ไข' }, { status: 422 })

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, status, deleted_at')
    .eq('id', profileId)
    .maybeSingle()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile || profile.status !== 'active' || profile.deleted_at) {
    return NextResponse.json({ error: 'เลือกได้เฉพาะบุคลากรที่ยังปฏิบัติงานอยู่' }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(patch)
    .eq('id', profileId)
    .select('id, dept, team_org_visible, dept_role, is_section_head')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log')
    .insert({
      action: teamOrgVisible === false ? 'personnel.team_org.remove' : dept !== undefined ? 'personnel.team_org.assign' : 'personnel.dept_role.set',
      user_id: actor.id,
      target: profileId,
      detail: JSON.stringify(patch),
    })
    .then(undefined, () => {})

  return NextResponse.json(data)
}
