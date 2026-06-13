import { NextRequest, NextResponse } from 'next/server'
import type { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireResource, type Actor } from '@/lib/auth/guards'

const RESOURCE = 'บุคลากร' as const

export function toMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

function auditChild(action: string, actor: Actor, target: string, detail?: string) {
  supabaseAdmin.from('audit_log')
    .insert({ action, user_id: actor.id, target, detail: detail ?? null })
    .then(undefined, () => {})
}

// GET list of child rows for a profile (view permission)
export async function listChildren(table: string, profileId: string) {
  const { actor, response } = await requireResource(RESOURCE, 'view')
  if (!actor) return response
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('*')
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST create a child row under a profile (edit permission)
export async function createChild<T extends z.ZodTypeAny>(
  req: NextRequest,
  table: string,
  profileId: string,
  schema: T,
) {
  const { actor, response } = await requireResource(RESOURCE, 'edit')
  if (!actor) return response
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
    }
    const { data, error } = await supabaseAdmin
      .from(table)
      .insert({ ...parsed.data, profile_id: profileId, created_by: actor.id })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    auditChild(`personnel.${table}.create`, actor, profileId, data.id)
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

// PATCH update a child row (edit permission)
export async function updateChild(
  req: NextRequest,
  table: string,
  childId: string,
  schema: z.AnyZodObject,
) {
  const { actor, response } = await requireResource(RESOURCE, 'edit')
  if (!actor) return response
  try {
    const body = await req.json()
    const parsed = schema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
    }
    const { data, error } = await supabaseAdmin
      .from(table)
      .update(parsed.data)
      .eq('id', childId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    auditChild(`personnel.${table}.update`, actor, childId)
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

// DELETE soft-delete a child row (edit permission)
export async function softDeleteChild(table: string, childId: string) {
  const { actor, response } = await requireResource(RESOURCE, 'edit')
  if (!actor) return response
  const { error } = await supabaseAdmin
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', childId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  auditChild(`personnel.${table}.delete`, actor, childId)
  return NextResponse.json({ ok: true })
}
