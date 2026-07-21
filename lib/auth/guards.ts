import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions, type PermLevel } from '@/lib/permissions'
import type { ResourceKey } from '@/lib/permission-resources'
import { normalizeRole } from '@/lib/roles'

export type Actor = {
  id: string
  role: string
  doc_role: string | null
  name?: string | null
  dept?: string | null
}

export const DOC_WORKFLOW_ROLES = [
  'Laboratory Director',
  'Quality Manager',
  'Document Controller',
  'Reviewer',
] as const

export function jsonUnauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function jsonForbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function isValidId(value: string): boolean {
  const id = Number(value)
  return Number.isInteger(id) && id > 0
}

export async function getActor(): Promise<Actor | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, role, doc_role, name, dept')
    .eq('id', user.id)
    .maybeSingle()

  if (!data) return null

  return {
    ...data,
    role: normalizeRole(data.role),
    doc_role: data.doc_role ?? null,
  } as Actor
}

// Public "เอกสารที่เกี่ยวข้อง" page sections — Admin (profiles.role) or DCC (profiles.doc_role)
export function canManagePublicSections(actor: Actor): boolean {
  return actor.role === 'Admin' || actor.doc_role === 'Document Controller'
}

export async function getPermissionLevel(actor: Actor, resource: ResourceKey): Promise<PermLevel> {
  const perms = await getRolePermissions(actor.role)
  return perms[resource] ?? 'none'
}

export function hasPermission(level: PermLevel, minimum: 'view' | 'edit' = 'view'): boolean {
  if (minimum === 'edit') return level === 'edit'
  return level === 'view' || level === 'edit'
}

export async function canAccessResource(
  actor: Actor,
  resource: ResourceKey,
  minimum: 'view' | 'edit' = 'view',
): Promise<boolean> {
  return hasPermission(await getPermissionLevel(actor, resource), minimum)
}

export async function canAccessDocuments(
  actor: Actor,
  minimum: 'view' | 'edit' = 'view',
): Promise<boolean> {
  if (actor.doc_role === 'Viewer' && minimum === 'view') return true
  if (DOC_WORKFLOW_ROLES.includes((actor.doc_role ?? actor.role) as (typeof DOC_WORKFLOW_ROLES)[number])) {
    return true
  }
  return canAccessResource(actor, 'เอกสารคุณภาพ', minimum)
}

export async function requireResource(
  resource: ResourceKey,
  minimum: 'view' | 'edit' = 'view',
): Promise<{ actor: Actor; response?: undefined } | { actor?: undefined; response: NextResponse }> {
  const actor = await getActor()
  if (!actor) return { response: jsonUnauthorized() }
  if (!(await canAccessResource(actor, resource, minimum))) return { response: jsonForbidden() }
  return { actor }
}

// Allows if actor is the profile owner (self-edit) OR has general บุคลากร edit permission
export async function requirePersonnelEdit(
  profileId: string,
): Promise<{ actor: Actor; response?: undefined } | { actor?: undefined; response: NextResponse }> {
  const actor = await getActor()
  if (!actor) return { response: jsonUnauthorized() }
  if (actor.id === profileId) return { actor }
  if (await canAccessResource(actor, 'บุคลากร', 'edit')) return { actor }
  return { response: jsonForbidden() }
}
