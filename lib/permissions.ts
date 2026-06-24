import { supabaseAdmin } from '@/lib/supabase/admin'
import { RESOURCES } from '@/lib/permission-resources'
import { normalizeRole } from '@/lib/roles'

export type { ResourceKey } from '@/lib/permission-resources'
export { RESOURCES } from '@/lib/permission-resources'

export type PermLevel = 'none' | 'view' | 'edit'
export type Permissions = Record<string, PermLevel>

export async function getRolePermissions(role: string): Promise<Permissions> {
  const normalizedRole = normalizeRole(role)
  if (normalizedRole === 'Admin') {
    return Object.fromEntries(RESOURCES.map(r => [r, 'edit' as PermLevel]))
  }

  const { data } = await supabaseAdmin
    .from('role_permissions')
    .select('resource')
    .eq('role', normalizedRole)

  const perms: Permissions = {}
  for (const row of (data ?? [])) {
    const raw = row.resource as string
    const i = raw.lastIndexOf(':')
    if (i === -1) continue
    const base = raw.slice(0, i)
    const level = raw.slice(i + 1) as PermLevel
    if (['none', 'view', 'edit'].includes(level)) perms[base] = level
  }
  return perms
}

export async function getPermissionsWithEquipmentOverride(
  role: string,
  userId: string,
): Promise<Permissions> {
  const perms = await getRolePermissions(role)
  if (normalizeRole(role) === 'Admin') return perms

  const { data, error } = await supabaseAdmin
    .from('equipment_editors')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  // Keep existing role-based behaviour if the readiness SQL has not been run yet.
  if (error) return perms
  if (data?.user_id) perms['ทะเบียนเครื่องมือ'] = 'edit'
  return perms
}
