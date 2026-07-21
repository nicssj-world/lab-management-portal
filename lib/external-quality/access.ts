import { NextResponse } from 'next/server'
import type { Actor } from '@/lib/auth/guards'
import type { PermLevel } from '@/lib/permissions'
import type { ResourceKey } from '@/lib/permission-resources'
import { isAdminRole } from '@/lib/roles'

export type ExternalQualityModule = 'outlab' | 'eqa'

export const EXTERNAL_QUALITY_RESOURCE: Record<ExternalQualityModule, ResourceKey> = {
  eqa: 'EQA / PT',
  outlab: 'OUTLAB',
}

// Admin and members of the module's editor list always get edit; everyone else
// follows the permission matrix level for the module resource.
export function externalQualityLevel(role: string, listedEditor: boolean, roleLevel: PermLevel): PermLevel {
  if (isAdminRole(role) || listedEditor) return 'edit'
  return roleLevel
}

export function canEditExternalQualityModule(role: string, listedEditor: boolean, roleLevel: PermLevel = 'none') {
  return externalQualityLevel(role, listedEditor, roleLevel) === 'edit'
}

export async function externalQualityContext(module: ExternalQualityModule, edit = false): Promise<{
  actor?: Actor
  canEdit?: boolean
  isAdmin?: boolean
  level?: PermLevel
  response?: NextResponse
}> {
  const [{ getActor }, { supabaseAdmin }, { getRolePermissions }] = await Promise.all([
    import('@/lib/auth/guards'),
    import('@/lib/supabase/admin'),
    import('@/lib/permissions'),
  ])
  const actor = await getActor()
  if (!actor) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const isAdmin = isAdminRole(actor.role)
  let listedEditor = false
  if (!isAdmin) {
    const { data, error } = await supabaseAdmin
      .from(`${module}_editors`)
      .select('user_id')
      .eq('user_id', actor.id)
      .maybeSingle()
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      return { response: NextResponse.json({ error: error.message }, { status: 500 }) }
    }
    listedEditor = Boolean(data?.user_id)
  }
  const perms = await getRolePermissions(actor.role)
  const level = externalQualityLevel(actor.role, listedEditor, perms[EXTERNAL_QUALITY_RESOURCE[module]] ?? 'none')
  const canEdit = level === 'edit'
  if (level === 'none') {
    return { actor, canEdit, isAdmin, level, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  if (edit && !canEdit) return { actor, canEdit, isAdmin, level, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { actor, canEdit, isAdmin, level }
}

export async function auditExternalQuality(
  module: ExternalQualityModule,
  action: string,
  actorId: string,
  target: string,
  detail?: string,
) {
  const { supabaseAdmin } = await import('@/lib/supabase/admin')
  await supabaseAdmin.from('audit_log').insert({
    action: `${module}.${action}`,
    user_id: actorId,
    target,
    detail: detail ?? null,
  }).then(undefined, () => {})
}

export function externalQualityError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected error'
  const status = /not found/i.test(message) ? 404 : /duplicate|unique/i.test(message) ? 409 : 422
  return NextResponse.json({ error: message }, { status })
}
