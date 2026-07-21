import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canManagePublicSections, getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { SectionItemsSchema, type SectionItemInput } from '@/lib/validations/public-document-section'

type Params = { params: Promise<{ id: string }> }

// Never trust the client on what may be exposed publicly — re-check every referenced
// row against the same conditions the public delivery routes enforce.
async function findInvalidItem(items: SectionItemInput[]): Promise<string | null> {
  const documentIds = items.flatMap((i) => (i.source === 'library' ? [i.document_id] : []))
  const attachmentIds = items.flatMap((i) => (i.source === 'test_attachment' ? [i.test_document_id] : []))
  const uploadIds = items.flatMap((i) => (i.source === 'upload' ? [i.upload_id] : []))

  if (documentIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('documents')
      .select('id')
      .in('id', documentIds)
      .is('deleted_at', null)
      .eq('visibility', 'Public')
      .eq('status', 'Published')
    const allowed = new Set((data ?? []).map((d) => d.id as string))
    const bad = documentIds.find((id) => !allowed.has(id))
    if (bad) return 'มีเอกสารที่ไม่ได้เผยแพร่สาธารณะ (ต้องเป็น Public + Published) อยู่ในรายการ'
  }

  if (attachmentIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('test_documents')
      .select('id, tests!inner(active)')
      .in('id', attachmentIds)
      .eq('visibility', 'Public')
      .eq('tests.active', true)
    const allowed = new Set((data ?? []).map((d) => d.id as number))
    const bad = attachmentIds.find((id) => !allowed.has(id))
    if (bad) return 'มีไฟล์แนบรายการตรวจที่ไม่ได้เผยแพร่ หรือรายการตรวจถูกปิดใช้งาน อยู่ในรายการ'
  }

  if (uploadIds.length > 0) {
    const { data } = await supabaseAdmin.from('public_section_uploads').select('id').in('id', uploadIds)
    const allowed = new Set((data ?? []).map((d) => d.id as string))
    const bad = uploadIds.find((id) => !allowed.has(id))
    if (bad) return 'มีไฟล์ที่อัปโหลดซึ่งไม่พบในระบบอยู่ในรายการ'
  }

  return null
}

export async function PUT(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!canManagePublicSections(actor)) return jsonForbidden()

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = SectionItemsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const { data: section } = await supabaseAdmin
    .from('public_document_sections')
    .select('id, kind, title_th')
    .eq('id', id)
    .maybeSingle()
  if (!section) return NextResponse.json({ error: 'ไม่พบ section' }, { status: 404 })
  if (section.kind === 'auto') {
    return NextResponse.json({ error: 'แถบจัดกลุ่มอัตโนมัติเลือกเอกสารเองไม่ได้' }, { status: 422 })
  }

  const invalid = await findInvalidItem(parsed.data.items)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 422 })

  const rows = parsed.data.items.map((item, index) => ({
    section_id: id,
    source: item.source,
    document_id: item.source === 'library' ? item.document_id : null,
    test_document_id: item.source === 'test_attachment' ? item.test_document_id : null,
    upload_id: item.source === 'upload' ? item.upload_id : null,
    label_override: item.label_override?.trim() || null,
    sort_order: index,
  }))

  const { error: deleteError } = await supabaseAdmin
    .from('public_document_section_items')
    .delete()
    .eq('section_id', id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from('public_document_section_items').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  supabaseAdmin.from('audit_log').insert({
    action: 'public_section_items', user_id: actor.id, target: id,
    detail: `ปรับรายการเอกสารใน section "${section.title_th}" (${rows.length} รายการ)`,
  }).then(undefined, () => {})

  const { data } = await supabaseAdmin
    .from('public_document_section_items')
    .select('*')
    .eq('section_id', id)
    .order('sort_order')

  return NextResponse.json(data ?? [])
}
