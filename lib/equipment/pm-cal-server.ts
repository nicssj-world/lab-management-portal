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

// PM recurs monthly by design (one active plan per equipment per month is normal), so PM conflicts
// are only checked within the same month. CAL is meant to happen once per fiscal year per equipment,
// so a CAL conflict is checked across the whole year regardless of month — otherwise a grouped CAL
// plan in a different month than an equipment's existing CAL plan would silently create a second,
// overlapping CAL schedule for that equipment instead of replacing the old one.
export async function findPmCalGroupConflicts(input: {
  equipmentIds: string[]; fiscalYear: number; calendarMonth: number; calType: 'PM' | 'CAL'; excludeGroupId?: string
}) {
  if (input.equipmentIds.length === 0) return []
  let query = supabaseAdmin.from('equipment_pm_cal_plans').select('equipment_id, plan_group_id, calendar_month')
    .in('equipment_id', input.equipmentIds).eq('fiscal_year', input.fiscalYear)
    .eq('cal_type', input.calType).eq('record_status', 'active')
  if (input.calType === 'PM') query = query.eq('calendar_month', input.calendarMonth)
  const { data: plans, error } = await query
  if (error) throw new Error(error.message)
  const conflicts = (plans ?? []).filter(plan => plan.plan_group_id !== input.excludeGroupId)
  const monthByEquipment = new Map(conflicts.map(plan => [plan.equipment_id, plan.calendar_month]))
  const ids = [...new Set(conflicts.map(plan => plan.equipment_id))]
  if (ids.length === 0) return []
  const { data: equipment, error: equipmentError } = await supabaseAdmin.from('equipment')
    .select('id, cbh_code, equipment_type').in('id', ids)
  if (equipmentError) throw new Error(equipmentError.message)
  return (equipment ?? []).map(item => ({ ...item, calendar_month: monthByEquipment.get(item.id) ?? null }))
}
