import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPermissionsWithEquipmentOverride } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const perms = await getPermissionsWithEquipmentOverride(profile.role, profile.id)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { ids?: unknown }
  const ids = body.ids
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: 'ids required' }, { status: 400 })

  const { data: deleted, error } = await supabaseAdmin
    .from('equipment')
    .delete()
    .in('id', ids)
    .select('id, equipment_type, cbh_code')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert(
    (deleted ?? []).map(d => ({
      action: 'equipment.delete',
      user_id: profile.id,
      target: d.cbh_code ?? d.id,
      detail: `${d.equipment_type ?? ''}${d.cbh_code ? ' · ' + d.cbh_code : ''}`,
    }))
  ).then(undefined, () => {})

  return NextResponse.json({ deleted: (deleted ?? []).length })
}
