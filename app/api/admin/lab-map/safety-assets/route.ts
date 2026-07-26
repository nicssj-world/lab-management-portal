import { NextRequest, NextResponse } from 'next/server'
import { requireSafetyEditor, requireSafetyViewer, auditSafety } from '@/lib/lab-map/safety-access'
import { listSafetyAssets } from '@/lib/lab-map/safety-server'
import { safetyAssetInputSchema } from '@/lib/validations/lab-map-safety'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const guard = await requireSafetyViewer()
  if (guard.response) return guard.response
  try {
    let items = await listSafetyAssets(req.nextUrl.searchParams.get('includeRetired') === '1')
    const code = req.nextUrl.searchParams.get('code')
    const kind = req.nextUrl.searchParams.get('kind')
    const status = req.nextUrl.searchParams.get('status')
    const q = req.nextUrl.searchParams.get('q')?.trim().toLocaleLowerCase('th')
    if (code) items = items.filter(item => item.code === code)
    if (kind) items = items.filter(item => item.kind === kind)
    if (status) items = items.filter(item => item.operationalStatus === status)
    if (q) items = items.filter(item => `${item.code} ${item.nameTh} ${item.sourceNoteTh ?? ''}`.toLocaleLowerCase('th').includes(q))
    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const parsed = safetyAssetInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  const value = parsed.data
  const { data, error } = await supabaseAdmin.from('lab_map_safety_assets').insert({
    code: value.code, name_th: value.nameTh, kind: value.kind, shutoff_for: value.shutoffFor ?? null,
    x: value.x, y: value.y, space_code: value.spaceCode ?? null,
    source_note_th: value.sourceNoteTh ?? null, created_by: guard.actor.id,
  }).select('*').single()
  if (error?.code === '23505') return NextResponse.json({ error: 'รหัสอุปกรณ์ซ้ำ' }, { status: 409 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  try { await auditSafety('lab_map.safety_asset.create', guard.actor.id, data.id, { code: data.code }) }
  catch (auditError) { return NextResponse.json({ error: (auditError as Error).message }, { status: 500 }) }
  return NextResponse.json({ data }, { status: 201 })
}
