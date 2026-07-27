import 'server-only'

import { NextResponse } from 'next/server'
import { getActor, jsonForbidden, jsonUnauthorized, type Actor } from '@/lib/auth/guards'
import { normalizeRole } from '@/lib/roles'
import { supabaseAdmin } from '@/lib/supabase/admin'

export function isSafetyManager(actor: Pick<Actor, 'role'>) {
  return ['Admin', 'Manager'].includes(normalizeRole(actor.role))
}

export async function isSafetyEditor(actor: Pick<Actor, 'id' | 'role'>) {
  if (isSafetyManager(actor)) return true
  const { data } = await supabaseAdmin
    .from('lab_map_safety_editors')
    .select('user_id')
    .eq('user_id', actor.id)
    .maybeSingle()
  return Boolean(data)
}

type GuardResult = { actor: Actor; response?: undefined } | { actor?: undefined; response: NextResponse }

export async function requireSafetyViewer(): Promise<GuardResult> {
  const actor = await getActor()
  return actor ? { actor } : { response: jsonUnauthorized() }
}

export async function requireSafetyEditor(): Promise<GuardResult> {
  const actor = await getActor()
  if (!actor) return { response: jsonUnauthorized() }
  if (!(await isSafetyEditor(actor))) return { response: jsonForbidden() }
  return { actor }
}

export async function requireSafetyManager(): Promise<GuardResult> {
  const actor = await getActor()
  if (!actor) return { response: jsonUnauthorized() }
  if (!isSafetyManager(actor)) return { response: jsonForbidden() }
  return { actor }
}

export async function requireSafetyAdmin(): Promise<GuardResult> {
  const actor = await getActor()
  if (!actor) return { response: jsonUnauthorized() }
  if (normalizeRole(actor.role) !== 'Admin') return { response: jsonForbidden() }
  return { actor }
}

export async function auditSafety(action: string, actorId: string, target: string, detail?: unknown) {
  const { error } = await supabaseAdmin.from('audit_log').insert({
    action,
    user_id: actorId,
    target,
    detail: detail == null ? target : JSON.stringify(detail),
  })
  if (error) throw new Error(`audit: ${error.message}`)
}
