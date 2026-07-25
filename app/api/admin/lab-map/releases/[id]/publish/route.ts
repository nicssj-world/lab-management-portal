import { NextResponse } from 'next/server'
import { getActor } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { currentManifestHash, validatePublishableRelease } from '@/lib/lab-map/release'
import { auditMapRelease, canManageMapReleases, mapReleaseRow } from '@/lib/lab-map/release-server'

type Context = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Context) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageMapReleases(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const { data: row, error: loadError } = await supabaseAdmin.from('lab_map_versions').select('*').eq('id', id).maybeSingle()
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'ไม่พบฉบับแผนที่' }, { status: 404 })
  if (row.status !== 'draft') return NextResponse.json({ error: 'เผยแพร่ได้เฉพาะฉบับร่าง' }, { status: 409 })
  const hash = currentManifestHash()
  if (row.manifest_hash !== hash) return NextResponse.json({ error: 'ผังเปลี่ยนหลังสร้างฉบับร่าง กรุณาสร้างฉบับใหม่' }, { status: 409 })
  const candidate = mapReleaseRow({ ...row, approved_at: new Date().toISOString() })
  const blockers = validatePublishableRelease(candidate)
  if (blockers.length) return NextResponse.json({ error: 'ยังเผยแพร่ไม่ได้', blockers }, { status: 422 })

  const { data, error } = await supabaseAdmin.rpc('publish_lab_map_release', {
    p_release_id: id,
    p_manifest_hash: hash,
    p_actor_id: actor.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  try { await auditMapRelease('lab_map.release.publish', actor.id, id, { manifestHash: hash }) }
  catch (auditError) { return NextResponse.json({ error: (auditError as Error).message }, { status: 500 }) }
  return NextResponse.json(data)
}
