import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActor, canAccessResource, jsonUnauthorized, jsonForbidden } from '@/lib/auth/guards'
import { canManagePersonnel } from '@/lib/personnel/roles'
import { toMsg } from '@/lib/personnel/crud'

const ROLE_LABEL = { assessor: 'ผู้ประเมิน (Assessor)', assessee: 'ผู้ถูกประเมิน (Assessee)' } as const

const SignoffSchema = z.object({ role: z.enum(['assessor', 'assessee']), value: z.boolean() })

// POST peer-assessment sign-off: assessor sign-off or assessee acknowledgement
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; compId: string }> }) {
  const { id, compId } = await ctx.params
  // Assessee (owner) may acknowledge their own; assessor sign-off is done by a manager.
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (actor.id !== id && !canManagePersonnel(actor.role) && !(await canAccessResource(actor, 'บุคลากร', 'edit'))) {
    return jsonForbidden()
  }
  try {
    const parsed = SignoffSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
    const now = parsed.data.value ? new Date().toISOString() : null
    const patch = parsed.data.role === 'assessor'
      ? { assessor_signoff: parsed.data.value, assessor_signoff_at: now }
      : { assessee_ack: parsed.data.value, assessee_ack_at: now }
    const { data, error } = await supabaseAdmin.from('staff_competencies').update(patch).eq('id', compId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    supabaseAdmin.from('audit_log')
      .insert({
        action: 'personnel.competency_signoff',
        user_id: actor.id,
        target: compId,
        detail: `${ROLE_LABEL[parsed.data.role]} · ${parsed.data.value ? 'ยืนยันแล้ว' : 'ยกเลิกการยืนยัน'}`,
      })
      .then(undefined, () => {})

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
