import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isAdminRole } from '@/lib/roles'
import { z } from 'zod'

// Managing the "คณะทำงาน IT" override is restricted to a real Admin — it grants
// admin-equivalent access to the whole งาน IT module, so only Admin may hand it out
// (an IT-editor override itself must not be usable to expand the committee further).
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  if (!data || !isAdminRole(data.role)) return null
  return data as { id: string; role: string }
}

export async function GET() {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('it_editors')
    .select('user_id, profile:profiles!it_editors_user_id_fkey(id, name, ephis_id)')
    .order('updated_at', { ascending: false })
  if (error) {
    if (error.message.includes('it_editors')) return NextResponse.json({ items: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ items: data ?? [] })
}

const bodySchema = z.object({ user_id: z.string().uuid() })

export async function POST(req: NextRequest) {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'กรุณาเลือกบุคลากร' }, { status: 422 })

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('id, name').eq('id', parsed.data.user_id).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'ไม่พบบุคลากรในทะเบียน' }, { status: 422 })

  const { data, error } = await supabaseAdmin
    .from('it_editors')
    .upsert({ user_id: parsed.data.user_id, updated_by: actor.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('user_id, profile:profiles!it_editors_user_id_fkey(id, name, ephis_id)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'it_editors.grant', user_id: actor.id, target: parsed.data.user_id,
    detail: `เพิ่ม ${profile.name} เข้าคณะทำงาน IT`,
  }).then(undefined, () => {})

  return NextResponse.json(data, { status: 201 })
}
