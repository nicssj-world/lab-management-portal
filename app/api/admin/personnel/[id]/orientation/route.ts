import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireResource } from '@/lib/auth/guards'
import { OrientationSchema, ORIENTATION_TEMPLATE } from '@/lib/validations/personnel'
import { toMsg } from '@/lib/personnel/crud'

// GET the orientation checklist for a profile (returns the template if none exists yet)
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await requireResource('บุคลากร', 'view')
  if (!actor) return response
  const { id } = await ctx.params
  const { data } = await supabaseAdmin.from('staff_orientation').select('*').eq('profile_id', id).maybeSingle()
  if (data) return NextResponse.json({ data })
  return NextResponse.json({ data: { profile_id: id, items: ORIENTATION_TEMPLATE.map((t) => ({ ...t, done: false })), completed_at: null, completed_by: null } })
}

// PUT upsert the checklist
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await requireResource('บุคลากร', 'edit')
  if (!actor) return response
  const { id } = await ctx.params
  try {
    const parsed = OrientationSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
    }
    const allDone = parsed.data.items.length > 0 && parsed.data.items.every((i) => i.done)
    const { data, error } = await supabaseAdmin
      .from('staff_orientation')
      .upsert({
        profile_id: id,
        items: parsed.data.items,
        completed_by: allDone ? actor.id : null,
        completed_at: allDone ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
