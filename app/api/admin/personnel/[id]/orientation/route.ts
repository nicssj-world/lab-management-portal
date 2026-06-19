import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireResource, requirePersonnelEdit } from '@/lib/auth/guards'
import { OrientationSchema, ORIENTATION_TEMPLATE } from '@/lib/validations/personnel'
import { toMsg } from '@/lib/personnel/crud'
import type { OrientationItem, StaffOrientation } from '@/lib/supabase/types'

type OrientationRow = StaffOrientation

function defaultItems(): OrientationItem[] {
  return ORIENTATION_TEMPLATE.map((t) => ({ ...t, done: false }))
}

function templateFromRows(rows: OrientationRow[]): OrientationItem[] {
  if (rows.length === 0) return defaultItems()

  const byKey = new Map<string, OrientationItem>()
  for (const row of rows) {
    for (const item of row.items ?? []) {
      if (!byKey.has(item.key)) byKey.set(item.key, { key: item.key, label: item.label, done: false })
    }
  }
  return Array.from(byKey.values())
}

function mergeTemplateWithDone(template: OrientationItem[], row?: OrientationRow | null): OrientationItem[] {
  const doneByKey = new Map((row?.items ?? []).map((item) => [item.key, item.done]))
  return template.map((item) => ({ ...item, done: doneByKey.get(item.key) ?? false }))
}

function structureSignature(items: OrientationItem[]): string {
  return items.map((item) => `${item.key}:${item.label}`).join('|')
}

function isStructureChange(before: OrientationItem[], after: OrientationItem[]): boolean {
  return structureSignature(before) !== structureSignature(after)
}

function completionFields(items: OrientationItem[], actorId: string, existing?: OrientationRow | null) {
  const allDone = items.length > 0 && items.every((item) => item.done)
  return {
    completed_by: allDone ? (existing?.completed_by ?? actorId) : null,
    completed_at: allDone ? (existing?.completed_at ?? new Date().toISOString()) : null,
  }
}

// GET the orientation checklist for a profile. The topic structure is shared across all staff.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await requireResource('บุคลากร', 'view')
  if (!actor) return response
  const { id } = await ctx.params
  const { data } = await supabaseAdmin.from('staff_orientation').select('*')
  const rows = (data ?? []) as OrientationRow[]
  const current = rows.find((row) => row.profile_id === id) ?? null
  const items = mergeTemplateWithDone(templateFromRows(rows), current)
  return NextResponse.json({
    data: {
      ...(current ?? {}),
      profile_id: id,
      items,
      completed_at: current?.completed_at ?? null,
      completed_by: current?.completed_by ?? null,
    },
  })
}

// PUT upsert the checklist. Done-state is per profile; topic add/remove is synced globally.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { actor, response } = await requirePersonnelEdit(id)
  if (!actor) return response
  try {
    const parsed = OrientationSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
    }

    const { data: existingData } = await supabaseAdmin.from('staff_orientation').select('*')
    const existingRows = (existingData ?? []) as OrientationRow[]
    const current = existingRows.find((row) => row.profile_id === id) ?? null
    const structureChanged = isStructureChange(templateFromRows(existingRows), parsed.data.items)

    if (structureChanged) {
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .is('deleted_at', null)
      if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

      const rowByProfile = new Map(existingRows.map((row) => [row.profile_id, row]))
      const template = parsed.data.items.map((item) => ({ key: item.key, label: item.label, done: false }))
      const submittedDoneByKey = new Map(parsed.data.items.map((item) => [item.key, item.done]))

      const rows = (profiles ?? []).map((profile) => {
        const profileId = profile.id as string
        const existing = rowByProfile.get(profileId) ?? null
        const existingDoneByKey = new Map((existing?.items ?? []).map((item) => [item.key, item.done]))
        const items = template.map((item) => ({
          ...item,
          done: profileId === id ? (submittedDoneByKey.get(item.key) ?? false) : (existingDoneByKey.get(item.key) ?? false),
        }))
        return {
          profile_id: profileId,
          items,
          ...completionFields(items, actor.id, existing),
          updated_at: new Date().toISOString(),
        }
      })

      const { data, error } = await supabaseAdmin
        .from('staff_orientation')
        .upsert(rows, { onConflict: 'profile_id' })
        .select()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json((data ?? []).find((row) => row.profile_id === id) ?? { profile_id: id, items: parsed.data.items })
    }

    const completion = completionFields(parsed.data.items, actor.id, current)
    const { data, error } = await supabaseAdmin
      .from('staff_orientation')
      .upsert({
        profile_id: id,
        items: parsed.data.items,
        ...completion,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
