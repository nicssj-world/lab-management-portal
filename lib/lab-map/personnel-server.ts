import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { LAB_SPACES, LAB_ZONES } from './manifest'
import type { PersonAssignmentInput } from './schemas'

export async function requireActiveMapProfile(profileId: string) {
  const { data, error } = await supabaseAdmin.from('profiles')
    .select('id').eq('id', profileId).is('deleted_at', null).maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function resolveAssignmentTarget(input: PersonAssignmentInput) {
  if (input.spaceCode) {
    if (!LAB_SPACES.some((space) => space.code === input.spaceCode)) return null
    const { data, error } = await supabaseAdmin.from('lab_map_spaces')
      .select('id,code').eq('code', input.spaceCode).eq('is_active', true).maybeSingle()
    if (error) throw new Error(error.message)
    return data ? { space_id: data.id as string, zone_id: null, targetCode: data.code as string } : null
  }
  if (!input.zoneCode || !LAB_ZONES.some((zone) => zone.code === input.zoneCode)) return null
  const { data, error } = await supabaseAdmin.from('lab_map_zones')
    .select('id,code').eq('code', input.zoneCode).eq('is_active', true).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? { space_id: null, zone_id: data.id as string, targetCode: data.code as string } : null
}

export async function auditMapPersonnel(
  action: string,
  actorId: string,
  assignmentId: string,
  detail: Record<string, unknown>,
) {
  const { error } = await supabaseAdmin.from('audit_log').insert({
    action,
    user_id: actorId,
    target: assignmentId,
    detail: JSON.stringify(detail),
  })
  if (error) throw new Error(`audit: ${error.message}`)
}
