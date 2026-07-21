import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canManagePublicSections, getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { SectionUpdateSchema } from '@/lib/validations/public-document-section'

type Params = { params: Promise<{ id: string }> }

async function requireManager() {
  const actor = await getActor()
  if (!actor) return { response: jsonUnauthorized() as NextResponse }
  if (!canManagePublicSections(actor)) return { response: jsonForbidden() as NextResponse }
  return { actor }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { actor, response } = await requireManager()
  if (response) return response

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = SectionUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const { data: current } = await supabaseAdmin
    .from('public_document_sections')
    .select('id, kind')
    .eq('id', id)
    .maybeSingle()
  if (!current) return NextResponse.json({ error: 'ไม่พบ section' }, { status: 404 })

  // settings only means anything on the auto group; ignore it elsewhere so a stray
  // payload cannot park unused config on a manual section.
  const patch = { ...parsed.data }
  if (current.kind !== 'auto') delete patch.settings

  const { data, error } = await supabaseAdmin
    .from('public_document_sections')
    .update({ ...patch, updated_at: new Date().toISOString(), updated_by: actor.id })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'public_section_update', user_id: actor.id, target: id,
    detail: `แก้ไข section หน้าเอกสารที่เกี่ยวข้อง: ${data.title_th}`,
  }).then(undefined, () => {})

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { actor, response } = await requireManager()
  if (response) return response

  const { id } = await params
  const { data: current } = await supabaseAdmin
    .from('public_document_sections')
    .select('id, kind, title_th')
    .eq('id', id)
    .maybeSingle()
  if (!current) return NextResponse.json({ error: 'ไม่พบ section' }, { status: 404 })

  // The auto group is where un-sectioned documents live — deleting it would silently
  // hide them. Hiding it is the supported way to take it off the page.
  if (current.kind === 'auto') {
    return NextResponse.json(
      { error: 'ลบแถบจัดกลุ่มอัตโนมัติไม่ได้ ให้ใช้การซ่อนแทน' },
      { status: 422 },
    )
  }

  const { error } = await supabaseAdmin.from('public_document_sections').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'public_section_delete', user_id: actor.id, target: id,
    detail: `ลบ section หน้าเอกสารที่เกี่ยวข้อง: ${current.title_th}`,
  }).then(undefined, () => {})

  return NextResponse.json({ ok: true })
}
