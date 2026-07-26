import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { sanitizeRichHtml, sanitizeInlineHtml } from '@/lib/html-sanitize'
import { manualSectionPatchSchema } from '@/lib/manual/control'
import { MANUAL_SECTIONS } from '@/app/(public)/manual/data'

const CORE_SELECT = 'id, body_html_th, body_html_en, table_data, updated_at'
const CONTROL_SELECT = 'owner_name_th, owner_name_en, revision_no, last_change_summary, updated_at'
const DRAFT_SELECT = 'body_html_th, body_html_en, table_data, owner_name_th, owner_name_en, updated_at'

function validSection(id: string) {
  return MANUAL_SECTIONS.some(section => section.id === id)
}

// Sanitize any string values inside table rows (inline HTML only); arrays of strings are line cells.
function sanitizeCell(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeInlineHtml(value)
  if (Array.isArray(value)) return value.map(v => (typeof v === 'string' ? sanitizeInlineHtml(v) : ''))
  return ''
}
function sanitizeTableData(input: Record<string, unknown[]>): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {}
  for (const [tableId, rows] of Object.entries(input)) {
    if (!Array.isArray(rows)) continue
    out[tableId] = rows.map(row => {
      if (!row || typeof row !== 'object') return {}
      const clean: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(row as Record<string, unknown>)) clean[k] = sanitizeCell(v)
      return clean
    })
  }
  return out
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!validSection(id)) return NextResponse.json({ error: 'Manual section not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('manual_sections')
    .select(CORE_SELECT)
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const actor = await getActor()
  const canEdit = Boolean(actor && ['Admin', 'Manager'].includes(actor.role))
  const [{ data: control }, { data: history }, draftResult] = await Promise.all([
    supabaseAdmin.from('manual_sections').select(CONTROL_SELECT).eq('id', id).maybeSingle(),
    supabaseAdmin
      .from('manual_section_revisions')
      .select('id, section_id, revision_no, change_summary, owner_name_th, owner_name_en, changed_at, changed_by_name')
      .eq('section_id', id)
      .order('revision_no', { ascending: false })
      .limit(20),
    canEdit
      ? supabaseAdmin.from('manual_section_drafts').select(DRAFT_SELECT).eq('section_id', id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const draft = draftResult.data
  const hasUnpublishedChanges = draft
    ? JSON.stringify({
      body_html_th: draft.body_html_th ?? '', body_html_en: draft.body_html_en ?? '', table_data: draft.table_data ?? null,
      owner_name_th: draft.owner_name_th ?? null, owner_name_en: draft.owner_name_en ?? null,
    }) !== JSON.stringify({
      body_html_th: data.body_html_th ?? '', body_html_en: data.body_html_en ?? '', table_data: data.table_data ?? null,
      owner_name_th: control?.owner_name_th ?? null, owner_name_en: control?.owner_name_en ?? null,
    })
    : false

  return NextResponse.json({
    ...data,
    control: control ?? null,
    history: history ?? [],
    ...(canEdit ? { draft: draft ?? null, has_unpublished_changes: hasUnpublishedChanges } : {}),
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!['Admin', 'Manager'].includes(actor.role))
    return jsonForbidden()

  const { id } = await params
  if (!validSection(id)) return NextResponse.json({ error: 'Manual section not found' }, { status: 404 })

  const parsed = manualSectionPatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }
  const body = parsed.data
  const { body_html_th, body_html_en, table_data, owner_name_th, owner_name_en } = body

  // Drafts are separate from the published manual. This makes repeated saves safe
  // while a reviewer prepares a single, meaningful section version for publishing.
  const { data: currentPublished, error: currentError } = await supabaseAdmin
    .from('manual_sections')
    .select('body_html_th, body_html_en, table_data')
    .eq('id', id)
    .single()
  if (currentError || !currentPublished) {
    return NextResponse.json({ error: currentError?.message ?? 'Manual section not found' }, { status: 404 })
  }

  const { data: currentControl, error: controlError } = await supabaseAdmin
    .from('manual_sections')
    .select(CONTROL_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (controlError) {
    return NextResponse.json({ error: 'กรุณาใช้ scripts/manual-web-source-of-truth.sql ก่อนแก้ข้อมูลควบคุม' }, { status: 503 })
  }

  const { data: existingDraft } = await supabaseAdmin
    .from('manual_section_drafts')
    .select(DRAFT_SELECT)
    .eq('section_id', id)
    .maybeSingle()

  const current = existingDraft ?? {
    body_html_th: currentPublished?.body_html_th ?? '',
    body_html_en: currentPublished?.body_html_en ?? '',
    table_data: currentPublished?.table_data ?? null,
    owner_name_th: currentControl?.owner_name_th ?? null,
    owner_name_en: currentControl?.owner_name_en ?? null,
  }

  const nextTableData = table_data
    ? { ...(current.table_data ?? {}), ...sanitizeTableData(table_data) }
    : (current.table_data ?? null)

  const updatePayload = {
    section_id: id,
    body_html_th: sanitizeRichHtml(body_html_th ?? current.body_html_th ?? ''),
    body_html_en: sanitizeRichHtml(body_html_en ?? current.body_html_en ?? ''),
    table_data: nextTableData,
    owner_name_th: owner_name_th !== undefined ? owner_name_th : (current.owner_name_th ?? null),
    owner_name_en: owner_name_en !== undefined ? owner_name_en : (current.owner_name_en ?? null),
    updated_at: new Date().toISOString(), updated_by: actor.id,
  }

  const { data: draft, error } = await supabaseAdmin
    .from('manual_section_drafts')
    .upsert(updatePayload)
    .select(DRAFT_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'manual_edit', user_id: actor.id, target: id,
    detail: `บันทึกร่างการแก้ไข · section: ${id}`,
  }).then(undefined, () => {})

  const { data: control } = await supabaseAdmin
    .from('manual_sections')
    .select(CONTROL_SELECT)
    .eq('id', id)
    .maybeSingle()

  return NextResponse.json({ draft, control: control ?? null })
}
