import 'server-only'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canAccessHeadContact } from './access'
import type { HeadContactActor } from './types'

export async function getHeadContactActor(): Promise<HeadContactActor | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, role, name, dept_role')
    .eq('id', user.id)
    .maybeSingle()
  return (data as HeadContactActor | null) ?? null
}

export async function requireHeadContactAccess(): Promise<{ error: NextResponse } | { actor: HeadContactActor }> {
  const actor = await getHeadContactActor()
  if (!actor) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!canAccessHeadContact(actor)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { actor }
}

export function auditHeadContact(action: string, userId: string, target: string, detail: string) {
  supabaseAdmin.from('audit_log').insert({ action, user_id: userId, target, detail })
    .then(undefined, () => {})
}
