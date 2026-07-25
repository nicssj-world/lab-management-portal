import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getActor } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditMapRelease, canManageMapReleases, mapReleaseRow } from '@/lib/lab-map/release-server'

const updateSchema = z.object({
  effectiveDate: z.string().date().nullable(),
  reviewedBy: z.string().uuid().nullable(),
  approvedBy: z.string().uuid().nullable(),
  notes: z.string().trim().max(2000).nullable(),
})
type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Context) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageMapReleases(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  const { data: current } = await supabaseAdmin.from('lab_map_versions').select('status').eq('id', id).maybeSingle()
  if (!current) return NextResponse.json({ error: 'ไม่พบฉบับแผนที่' }, { status: 404 })
  if (current.status !== 'draft') return NextResponse.json({ error: 'แก้ไขได้เฉพาะฉบับร่าง' }, { status: 409 })
  const { data, error } = await supabaseAdmin.from('lab_map_versions').update({
    effective_date: parsed.data.effectiveDate,
    reviewed_by: parsed.data.reviewedBy,
    approved_by: parsed.data.approvedBy,
    notes: parsed.data.notes,
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('status', 'draft').select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  try { await auditMapRelease('lab_map.release.update', actor.id, id, parsed.data) }
  catch (auditError) { return NextResponse.json({ error: (auditError as Error).message }, { status: 500 }) }
  return NextResponse.json(mapReleaseRow(data))
}
