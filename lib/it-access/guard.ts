import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPermissionsWithItOverride } from '@/lib/permissions'
import { NextResponse } from 'next/server'

export const IT_RESOURCE = 'ระบบสารสนเทศ (IT)'

export type ItActor = { id: string; role: string; name: string | null }

export async function getItActor(): Promise<ItActor | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role, name').eq('id', user.id).single()
  return (data as ItActor) ?? null
}

// Resolves the actor and enforces the IT permission at `level`.
// Returns either an error response to bail out with, or the actor to proceed.
export async function requireIt(level: 'view' | 'edit'): Promise<{ error: NextResponse } | { actor: ItActor }> {
  const actor = await getItActor()
  if (!actor) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const perms = await getPermissionsWithItOverride(actor.role, actor.id)
  const perm = perms[IT_RESOURCE] ?? 'none'
  const ok = level === 'edit' ? perm === 'edit' : perm !== 'none'
  if (!ok) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { actor }
}

// Fire-and-forget audit log (non-critical), matching the project convention.
export function auditIt(action: string, userId: string, target: string, detail: string) {
  supabaseAdmin.from('audit_log').insert({ action, user_id: userId, target, detail })
    .then(undefined, () => {})
}
