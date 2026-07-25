import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getActor } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { currentManifestHash } from '@/lib/lab-map/release'
import { auditMapRelease, canManageMapReleases, mapReleaseRow } from '@/lib/lab-map/release-server'

const createSchema = z.object({
  versionCode: z.string().trim().min(3).max(80),
  effectiveDate: z.string().date().nullable().optional(),
  reviewedBy: z.string().uuid().nullable().optional(),
  approvedBy: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabaseAdmin.from('lab_map_versions').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: (data ?? []).map((row) => mapReleaseRow(row)) })
}

export async function POST(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageMapReleases(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('lab_map_versions').insert({
    version_code: parsed.data.versionCode,
    status: 'draft',
    manifest_hash: currentManifestHash(),
    effective_date: parsed.data.effectiveDate ?? null,
    reviewed_by: parsed.data.reviewedBy ?? null,
    approved_by: parsed.data.approvedBy ?? null,
    notes: parsed.data.notes ?? null,
    created_by: actor.id,
  }).select('*').single()
  if (error?.code === '23505') return NextResponse.json({ error: 'รหัสเวอร์ชันซ้ำ' }, { status: 409 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  try { await auditMapRelease('lab_map.release.create', actor.id, data.id, { versionCode: data.version_code }) }
  catch (auditError) { return NextResponse.json({ error: (auditError as Error).message }, { status: 500 }) }
  return NextResponse.json(mapReleaseRow(data), { status: 201 })
}
