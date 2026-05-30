import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['บันทึกการแก้ไข'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  if (body.title !== undefined && !body.title?.trim())
    return NextResponse.json({ error: 'กรุณาระบุหัวข้อ' }, { status: 422 })

  const { date, category, title, description, changed_by, changed_by_id } = body
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (date !== undefined) patch.date = date
  if (category !== undefined) patch.category = category
  if (title !== undefined) patch.title = title
  if (description !== undefined) patch.description = description
  if (changed_by !== undefined) patch.changed_by = changed_by
  if (changed_by_id !== undefined) patch.changed_by_id = changed_by_id

  const { data, error } = await supabaseAdmin
    .from('system_changelog')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let changed_by_avatar: string | null = null
  if (data.changed_by_id) {
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('avatar_url').eq('id', data.changed_by_id).single()
    changed_by_avatar = profile?.avatar_url ?? null
  }

  return NextResponse.json({ ...data, changed_by_avatar })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['บันทึกการแก้ไข'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { error } = await supabaseAdmin.from('system_changelog').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
