import { NextResponse } from 'next/server'
import { getActor, jsonForbidden, jsonUnauthorized, type Actor } from '@/lib/auth/guards'
import { getPermissionsWithSatisfactionOverride } from '@/lib/permissions'

export const SATISFACTION_RESOURCE = 'แบบสำรวจความพึงพอใจ'

// Resolves the actor and enforces the satisfaction permission at `level`, honouring
// the per-person satisfaction_editors override on top of the role permission matrix.
// Replaces requireResource() for this module so an assigned editor is accepted by
// every route, not just the pages.
export async function requireSatisfaction(
  level: 'view' | 'edit' = 'view',
): Promise<{ actor: Actor; response?: undefined } | { actor?: undefined; response: NextResponse }> {
  const actor = await getActor()
  if (!actor) return { response: jsonUnauthorized() }
  const perms = await getPermissionsWithSatisfactionOverride(actor.role, actor.id)
  const perm = perms[SATISFACTION_RESOURCE] ?? 'none'
  const ok = level === 'edit' ? perm === 'edit' : perm !== 'none'
  if (!ok) return { response: jsonForbidden() }
  return { actor }
}
