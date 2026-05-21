import { supabaseAdmin } from '@/lib/supabase/admin'
import { RESOURCES } from '@/lib/permission-resources'

export type { ResourceKey } from '@/lib/permission-resources'
export { RESOURCES } from '@/lib/permission-resources'

export type PermLevel = 'none' | 'view' | 'edit'
export type Permissions = Record<string, PermLevel>

export async function getRolePermissions(role: string): Promise<Permissions> {
  if (role === 'Admin') {
    return Object.fromEntries(RESOURCES.map(r => [r, 'edit' as PermLevel]))
  }

  const { data } = await supabaseAdmin
    .from('role_permissions')
    .select('resource')
    .eq('role', role)

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
