import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPermissionsWithEquipmentOverride } from '@/lib/permissions'

export interface PmCalActor {
  id: string
  role: string
  permission: 'view' | 'edit'
}

export async function getPmCalActor(required: 'read' | 'edit'): Promise<PmCalActor | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  if (!profile) return null
  const permissions = await getPermissionsWithEquipmentOverride(profile.role, profile.id)
  const permission = permissions['ทะเบียนเครื่องมือ'] ?? 'none'
  if (permission === 'none' || (required === 'edit' && permission !== 'edit')) return null
  return { id: profile.id, role: profile.role, permission }
}

export async function writePmCalAudit(actorId: string, action: string, target: string, detail: string) {
  const { error } = await supabaseAdmin.from('audit_log').insert({ action, user_id: actorId, target, detail })
  if (error) console.error('PM/CAL audit log:', error.message)
}
