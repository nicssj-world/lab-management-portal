import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRiskActor } from '@/lib/risk/access'
import { isAdminRole } from '@/lib/roles'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function requireAdmin() {
  const actor = await getRiskActor()
  if (!actor || !isAdminRole(actor.role)) return null
  return actor
}

const missingTable = (message: string) => /does not exist|schema cache/i.test(message)

export async function GET() {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('risk_team_members')
    .select('user_id')
    .order('updated_at', { ascending: false })

  if (error) {
    if (missingTable(error.message)) return NextResponse.json({ user_ids: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ user_ids: (data ?? []).map(row => row.user_id) })
}

const bodySchema = z.object({
  user_id: z.string().uuid(),
  enabled: z.boolean(),
})

export async function PATCH(req: NextRequest) {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'กรุณาเลือกบุคลากร' }, { status: 422 })

  const { user_id, enabled } = parsed.data
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, name, status, deleted_at')
    .eq('id', user_id)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'ไม่พบบุคลากรในทะเบียน' }, { status: 422 })
  if (enabled && (profile.status !== 'active' || profile.deleted_at !== null)) {
    return NextResponse.json({ error: 'สามารถแต่งตั้งได้เฉพาะบุคลากรที่ active' }, { status: 422 })
  }

  const result = enabled
    ? await supabaseAdmin.from('risk_team_members').upsert(
        { user_id, updated_by: actor.id, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
    : await supabaseAdmin.from('risk_team_members').delete().eq('user_id', user_id)

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: enabled ? 'risk_team_members.grant' : 'risk_team_members.revoke',
    user_id: actor.id,
    target: user_id,
    detail: `${enabled ? 'เพิ่ม' : 'ถอน'} ${profile.name} จากคณะทำงานความเสี่ยง`,
  }).then(undefined, () => {})

  return NextResponse.json({ ok: true, user_id, enabled })
}
