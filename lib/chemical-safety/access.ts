import 'server-only'

import type { NextResponse } from 'next/server'
import { getActor, jsonForbidden, jsonUnauthorized, type Actor } from '@/lib/auth/guards'
import { normalizeRole } from '@/lib/roles'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type ChemicalScope = { unitId: string; role: 'custodian' | 'reviewer' }
export type ChemicalAction =
  | { action: 'view' }
  | { action: 'edit' | 'review'; unitId: string }
  | { action: 'manage_roles' | 'retire' }

type GuardResult = { actor: Actor; response?: undefined } | { actor?: undefined; response: NextResponse }

export function chemicalAccessDecision(
  actor: Pick<Actor, 'id' | 'role'>,
  _scopes: ChemicalScope[],
  _request: ChemicalAction,
): boolean {
  return normalizeRole(actor.role) === 'Admin'
}

async function loadScopes(actorId: string): Promise<ChemicalScope[]> {
  const { data, error } = await supabaseAdmin
    .from('chemical_role_scopes')
    .select('unit_id, role')
    .eq('user_id', actorId)
  if (error) throw new Error(`chemical role scopes: ${error.message}`)
  return (data ?? []).map(row => ({
    unitId: String(row.unit_id),
    role: row.role as ChemicalScope['role'],
  }))
}

async function requireAction(action: ChemicalAction): Promise<GuardResult> {
  const actor = await getActor()
  if (!actor) return { response: jsonUnauthorized() }
  const scopes = action.action === 'view' || action.action === 'manage_roles' || action.action === 'retire'
    ? []
    : await loadScopes(actor.id)
  return chemicalAccessDecision(actor, scopes, action) ? { actor } : { response: jsonForbidden() }
}

export function requireChemicalViewer() {
  return requireAction({ action: 'view' })
}

export function requireChemicalCustodian(unitId: string) {
  return requireAction({ action: 'edit', unitId })
}

export function requireChemicalReviewer(unitId: string) {
  return requireAction({ action: 'review', unitId })
}

export function requireChemicalAdmin() {
  return requireAction({ action: 'manage_roles' })
}
