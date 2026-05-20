import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { updateUserSchema } from '@/lib/validations/user-schema'
import { updateUser, setUserStatus, softDeleteUser } from '@/lib/services/users'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role?.toLowerCase() !== 'admin') return null
  return profile as { id: string; role: string }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const actor = await requireAdmin(supabase)
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()

    // Status-only toggle shortcut
    if (body._action === 'toggle_status') {
      const updated = await setUserStatus(supabaseAdmin, id, body.status, actor.id)
      return NextResponse.json({ success: true, user: updated })
    }

    const parsed = updateUserSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง'
      return NextResponse.json({ error: firstError }, { status: 422 })
    }

    const updated = await updateUser(supabaseAdmin, id, parsed.data, actor.id)
    return NextResponse.json({ success: true, user: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const actor = await requireAdmin(supabase)
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await softDeleteUser(supabaseAdmin, id, actor.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
