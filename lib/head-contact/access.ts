import type { DeptRole } from '@/lib/supabase/types'
import { isAdminRole } from '@/lib/roles'

type HeadContactAccessActor = { role: string | null | undefined; dept_role: DeptRole | null | undefined }

export function canAccessHeadContact(actor: HeadContactAccessActor): boolean {
  return isAdminRole(actor.role) || actor.dept_role === 'group_lead'
}

export function canDeleteHeadContact(actor: Pick<HeadContactAccessActor, 'role'>): boolean {
  return isAdminRole(actor.role)
}
