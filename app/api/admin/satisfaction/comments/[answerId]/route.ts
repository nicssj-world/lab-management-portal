import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireResource } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

const readStateSchema = z.object({ read: z.boolean() })
type Context = { params: Promise<{ answerId: string }> }

export async function PATCH(request: Request, { params }: Context) {
  const access = await requireResource('แบบสำรวจความพึงพอใจ', 'view')
  if (access.response) return access.response
  const actor = access.actor
  if (!(actor.role === 'Admin' || actor.role === 'Manager')) {
    return NextResponse.json({ error: 'เฉพาะ Admin หรือ Manager เท่านั้น' }, { status: 403 })
  }
  const parsed = readStateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  const { answerId } = await params
  const { error } = await supabaseAdmin.from('survey_answers').update({
    comment_read_at: parsed.data.read ? new Date().toISOString() : null,
    comment_read_by: parsed.data.read ? actor.id : null,
  }).eq('id', answerId).eq('is_comment', true)
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true })
}
