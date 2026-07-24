import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePersonnelManage } from '@/lib/auth/guards'

const Schema = z.object({
  profileId: z.string().uuid(),
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
  const { profileId, deptRole, isSectionHead } = parsed.data
  const patch: Record<string, unknown> = {}
  if (deptRole !== undefined) patch.dept_role = deptRole
  if (isSectionHead !== undefined) patch.is_section_head = isSectionHead
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'ไม่มีข้อมูลให้แก้ไข' }, { status: 422 })

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(patch)
    .eq('id', profileId)
    .select('id, dept_role, is_section_head')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log')
    .insert({ action: 'personnel.dept_role.set', user_id: actor.id, target: profileId, detail: JSON.stringify(patch) })
    .then(undefined, () => {})

  return NextResponse.json(data)
}
