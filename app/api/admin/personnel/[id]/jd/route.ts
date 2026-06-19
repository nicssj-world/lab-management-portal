import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireResource, requirePersonnelEdit } from '@/lib/auth/guards'
import { JdSchema } from '@/lib/validations/personnel'
import { toMsg } from '@/lib/personnel/crud'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await requireResource('บุคลากร', 'view')
  if (!actor) return response
  const { id } = await ctx.params
  const { data, error } = await supabaseAdmin
    .from('staff_jd')
    .select('*')
    .eq('profile_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { actor, response } = await requirePersonnelEdit(id)
  if (!actor) return response
  try {
    const parsed = JdSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
    }
    const { revision_note, ...fields } = parsed.data
    void revision_note
    const { data, error } = await supabaseAdmin
      .from('staff_jd')
      .insert({ ...fields, profile_id: id, created_by: actor.id })
      .select()
      .single()
    if (error && error.message.includes('approver_position')) {
      const { approver_position, ...legacyFields } = fields
      void approver_position
      const fallback = await supabaseAdmin
        .from('staff_jd')
        .insert({ ...legacyFields, profile_id: id, created_by: actor.id })
        .select()
        .single()
      if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 })
      return NextResponse.json(fallback.data, { status: 201 })
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    supabaseAdmin.from('audit_log').insert({ action: 'personnel.jd.create', user_id: actor.id, target: id }).then(undefined, () => {})
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
