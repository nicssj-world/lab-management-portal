import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canManagePublicSections, getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { SectionCreateSchema, SectionReorderSchema } from '@/lib/validations/public-document-section'

async function requireManager() {
  const actor = await getActor()
  if (!actor) return { response: jsonUnauthorized() as NextResponse }
  if (!canManagePublicSections(actor)) return { response: jsonForbidden() as NextResponse }
  return { actor }
}

export async function POST(req: NextRequest) {
  const { actor, response } = await requireManager()
  if (response) return response

  const body = await req.json().catch(() => null)
  const parsed = SectionCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  // New manual sections go above the auto group (which is seeded at sort_order 1000).
  const { data: last } = await supabaseAdmin
    .from('public_document_sections')
    .select('sort_order')
    .eq('kind', 'manual')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabaseAdmin
    .from('public_document_sections')
    .insert({
      ...parsed.data,
      kind: 'manual',
      sort_order: (last?.sort_order ?? 0) + 1,
      updated_by: actor.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'public_section_create', user_id: actor.id, target: data.id,
    detail: `สร้าง section หน้าเอกสารที่เกี่ยวข้อง: ${data.title_th}`,
  }).then(undefined, () => {})

  return NextResponse.json(data, { status: 201 })
}

// Reorder — body { ids: [...] } writes sort_order by array index.
export async function PATCH(req: NextRequest) {
  const { actor, response } = await requireManager()
  if (response) return response

  const body = await req.json().catch(() => null)
  const parsed = SectionReorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'รายการลำดับไม่ถูกต้อง' }, { status: 422 })
  }

  for (const [index, id] of parsed.data.ids.entries()) {
    const { error } = await supabaseAdmin
      .from('public_document_sections')
      .update({ sort_order: index, updated_at: new Date().toISOString(), updated_by: actor.id })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  supabaseAdmin.from('audit_log').insert({
    action: 'public_section_reorder', user_id: actor.id, target: null,
    detail: `จัดลำดับ section หน้าเอกสารที่เกี่ยวข้องใหม่ (${parsed.data.ids.length} รายการ)`,
  }).then(undefined, () => {})

  return NextResponse.json({ ok: true })
}
