import 'server-only'

import type { NextResponse } from 'next/server'
import { getActor, jsonForbidden, jsonUnauthorized, type Actor } from '@/lib/auth/guards'
import { normalizeRole } from '@/lib/roles'
import { isSafetyEditor } from '@/lib/lab-map/safety-access'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type ChemicalScope = { unitId: string; role: 'custodian' | 'reviewer' }
export type ChemicalAction =
  | { action: 'view' }
  | { action: 'edit'; unitId: string }
  | { action: 'manage_roles' | 'retire' }

type GuardResult = { actor: Actor; response?: undefined } | { actor?: undefined; response: NextResponse }

export async function chemicalAccessDecision(
  actor: Pick<Actor, 'id' | 'role'>,
  scopes: ChemicalScope[],
  request: ChemicalAction,
): Promise<boolean> {
  if (normalizeRole(actor.role) === 'Admin') return true
  if (request.action === 'manage_roles') return false
  if (await isSafetyEditor(actor)) return true
  if (request.action === 'view') return scopes.length > 0
  if (request.action !== 'edit') return false
  // เดิมแยก custodian = เสนอแก้ไข / reviewer = อนุมัติ เมื่อไม่มีขั้นตอนอนุมัติแล้ว
  // ถ้าเทียบ reviewer เป็นสิทธิ์ดูอย่างเดียว คนที่เคยกดอนุมัติได้จะทำอะไรไม่ได้เลย
  // จึงให้ทั้งสองบทบาทที่ถูกมอบหมายในหน่วยงานนั้นแก้ไขได้เท่ากัน
  return scopes.some(scope => scope.unitId === request.unitId)
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
  const scopes = action.action === 'manage_roles' || action.action === 'retire'
    ? []
    : await loadScopes(actor.id)
  return await chemicalAccessDecision(actor, scopes, action) ? { actor } : { response: jsonForbidden() }
}

export function requireChemicalViewer() {
  return requireAction({ action: 'view' })
}

export function requireChemicalCustodian(unitId: string) {
  return requireAction({ action: 'edit', unitId })
}

export function requireChemicalAdmin() {
  return requireAction({ action: 'manage_roles' })
}
