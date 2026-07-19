import { NextResponse } from 'next/server'
import type { Actor } from '@/lib/auth/guards'
import { isAdminRole } from '@/lib/roles'

export type ExternalQualityModule = 'outlab' | 'eqa'

export function canEditExternalQualityModule(role: string, listedEditor: boolean) {
  return isAdminRole(role) || listedEditor
}

export async function externalQualityContext(module: ExternalQualityModule, edit = false): Promise<{
  actor?: Actor
  canEdit?: boolean
  isAdmin?: boolean
  response?: NextResponse
}> {
  const [{ getActor }, { supabaseAdmin }] = await Promise.all([
    import('@/lib/auth/guards'),
    import('@/lib/supabase/admin'),
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
  const canEdit = canEditExternalQualityModule(actor.role, listedEditor)
  if (edit && !canEdit) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { actor, canEdit, isAdmin }
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
