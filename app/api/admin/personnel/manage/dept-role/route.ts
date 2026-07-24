import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePersonnelManage } from '@/lib/auth/guards'

const Schema = z.object({
  profileId: z.string().uuid(),
  deptRole: z.enum(['group_lead', 'group_deputy', 'section_head']).nullable(),
})

// Set a person's placement in the group org chart. Admin/Manager only.
export async function PATCH(req: NextRequest) {
  const { actor, response } = await requirePersonnelManage()
  if (!actor) return response
  const parsed = Schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }
  const { profileId, deptRole } = parsed.data
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ dept_role: deptRole })
    .eq('id', profileId)
    .select('id, dept_role')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log')
    .insert({ action: 'personnel.dept_role.set', user_id: actor.id, target: profileId, detail: deptRole ?? 'member' })
    .then(undefined, () => {})

  return NextResponse.json(data)
}
