import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isAdminRole } from '@/lib/roles'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  if (!data || !isAdminRole(data.role)) return null
  return data as { id: string; role: string }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { userId } = await params

  const { data: profile } = await supabaseAdmin.from('profiles').select('name').eq('id', userId).maybeSingle()
  const { error } = await supabaseAdmin.from('it_editors').delete().eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'it_editors.revoke', user_id: actor.id, target: userId,
    detail: `ถอน ${profile?.name ?? ''} ออกจากคณะทำงาน IT`,
  }).then(undefined, () => {})

  return NextResponse.json({ ok: true })
}
