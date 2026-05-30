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

export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['บันทึกการแก้ไข'] ?? 'none') === 'none')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')

  let query = supabaseAdmin
    .from('system_changelog')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,changed_by.ilike.%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = [...new Set((data ?? []).filter(i => i.changed_by_id).map(i => i.changed_by_id as string))]
  const avatarMap: Record<string, string | null> = {}
  if (ids.length) {
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, avatar_url').in('id', ids)
    for (const p of profiles ?? []) avatarMap[p.id] = p.avatar_url ?? null
  }

  return NextResponse.json((data ?? []).map(i => ({ ...i, changed_by_avatar: i.changed_by_id ? (avatarMap[i.changed_by_id] ?? null) : null })))
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['บันทึกการแก้ไข'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (!body.title?.trim()) return NextResponse.json({ error: 'กรุณาระบุหัวข้อ' }, { status: 422 })
  if (!body.changed_by?.trim()) return NextResponse.json({ error: 'กรุณาระบุผู้ดำเนินการ' }, { status: 422 })

  const { data, error } = await supabaseAdmin
    .from('system_changelog')
    .insert({ ...body, changed_by_id: actor.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
