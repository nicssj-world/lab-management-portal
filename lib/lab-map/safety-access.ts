import 'server-only'

import { NextResponse } from 'next/server'
import { getActor, jsonForbidden, jsonUnauthorized, type Actor } from '@/lib/auth/guards'
import { normalizeRole } from '@/lib/roles'
import { supabaseAdmin } from '@/lib/supabase/admin'

export function isSafetyRoleManager(actor: Pick<Actor, 'role'>) {
  return ['Admin', 'Manager'].includes(normalizeRole(actor.role))
}

async function isSafetyCommitteeMember(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('lab_map_safety_editors')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  return !error && Boolean(data)
}

/** Admin-equivalent access inside the safety workstream only. */
export async function isSafetyManager(actor: Pick<Actor, 'id' | 'role'>) {
  if (isSafetyRoleManager(actor)) return true
  return isSafetyCommitteeMember(actor.id)
}

export async function isSafetyEditor(actor: Pick<Actor, 'id' | 'role'>) {
  return isSafetyManager(actor)
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
  if (!(await isSafetyManager(actor))) return { response: jsonForbidden() }
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
