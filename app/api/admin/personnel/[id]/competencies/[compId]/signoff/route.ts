import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePersonnelEdit } from '@/lib/auth/guards'
import { toMsg } from '@/lib/personnel/crud'

const SignoffSchema = z.object({ role: z.enum(['assessor', 'assessee']), value: z.boolean() })

// POST peer-assessment sign-off: assessor sign-off or assessee acknowledgement
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; compId: string }> }) {
  const { id, compId } = await ctx.params
  const { actor, response } = await requirePersonnelEdit(id)
  if (!actor) return response
  try {
    const parsed = SignoffSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
    const now = parsed.data.value ? new Date().toISOString() : null
    const patch = parsed.data.role === 'assessor'
      ? { assessor_signoff: parsed.data.value, assessor_signoff_at: now }
      : { assessee_ack: parsed.data.value, assessee_ack_at: now }
    const { data, error } = await supabaseAdmin.from('staff_competencies').update(patch).eq('id', compId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
