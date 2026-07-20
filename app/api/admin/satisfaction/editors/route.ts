import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getActor } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isAdminRole } from '@/lib/roles'

// Managing this override is restricted to a real Admin — it grants edit access to the
// whole satisfaction module, so an assigned editor must not be able to add more editors.
async function requireAdmin() {
  const actor = await getActor()
  if (!actor || !isAdminRole(actor.role)) return null
  return actor
}

const missingTable = (message: string) => /does not exist|schema cache/i.test(message)

export async function GET() {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [editors, people] = await Promise.all([
    supabaseAdmin.from('satisfaction_editors').select('user_id'),
    supabaseAdmin.from('profiles').select('id, name, role, dept').order('name'),
  ])
  if (editors.error && !missingTable(editors.error.message)) {
    return NextResponse.json({ error: editors.error.message }, { status: 500 })
  }
  if (people.error) return NextResponse.json({ error: people.error.message }, { status: 500 })

  return NextResponse.json({
    userIds: (editors.data ?? []).map((row) => row.user_id as string),
    people: people.data ?? [],
  })
}

const bodySchema = z.object({ userId: z.string().uuid(), enabled: z.boolean() })

export async function PATCH(request: NextRequest) {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'กรุณาเลือกบุคลากร' }, { status: 422 })

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('id, name').eq('id', parsed.data.userId).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'ไม่พบบุคลากรในทะเบียน' }, { status: 422 })

  const result = parsed.data.enabled
    ? await supabaseAdmin.from('satisfaction_editors').upsert(
        { user_id: parsed.data.userId, updated_by: actor.id, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
    : await supabaseAdmin.from('satisfaction_editors').delete().eq('user_id', parsed.data.userId)
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: parsed.data.enabled ? 'satisfaction_editors.grant' : 'satisfaction_editors.revoke',
    user_id: actor.id,
    target: parsed.data.userId,
    detail: `${parsed.data.enabled ? 'เพิ่ม' : 'ถอน'} ${profile.name} ผู้ได้รับมอบหมายแบบสำรวจความพึงพอใจ`,
  }).then(undefined, () => {})

  return NextResponse.json({ ok: true })
}
