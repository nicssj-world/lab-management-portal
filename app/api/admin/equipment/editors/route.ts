import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { normalizeRole } from '@/lib/roles'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (!data || normalizeRole(data.role) !== 'Admin') return null
  return data as { id: string; role: string }
}

function toMsg(err: unknown) {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    return String(e.message ?? e.error ?? JSON.stringify(err))
  }
  return String(err ?? 'Unknown error')
}

export async function GET() {
  try {
    const actor = await requireAdmin()
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await supabaseAdmin
      .from('equipment_editors')
      .select('user_id')
      .order('updated_at', { ascending: false })

    if (error) {
      if (error.message.includes('equipment_editors')) return NextResponse.json({ user_ids: [] })
      throw error
    }

    return NextResponse.json({ user_ids: (data ?? []).map(row => row.user_id) })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

const patchSchema = z.object({
  user_id: z.string().uuid(),
  enabled: z.boolean(),
})

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAdmin()
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
    }

    const { user_id, enabled } = parsed.data
    if (enabled) {
      const { error } = await supabaseAdmin
        .from('equipment_editors')
        .upsert({ user_id, updated_by: actor.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      if (error) throw error
    } else {
      const { error } = await supabaseAdmin
        .from('equipment_editors')
        .delete()
        .eq('user_id', user_id)
      if (error) throw error
    }

    await supabaseAdmin.from('audit_log').insert({
      action: 'equipment.permission.update',
      user_id: actor.id,
      target: user_id,
      detail: enabled ? 'Granted equipment editor override' : 'Revoked equipment editor override',
    }).then(undefined, () => {})

    return NextResponse.json({ success: true, user_id, enabled })
  } catch (err) {
    const msg = toMsg(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
