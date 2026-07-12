import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { sanitizeRichHtml, sanitizeInlineHtml } from '@/lib/html-sanitize'

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
  const { data, error } = await supabaseAdmin
    .from('manual_sections')
    .select('id, body_html_th, body_html_en, table_data, updated_at')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
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
  const body = await req.json()
  const { body_html_th, body_html_en, table_data } = body as {
    body_html_th?: string
    body_html_en?: string
    table_data?: Record<string, unknown[]>
  }

  // Load current row so we can merge table_data and not clobber sibling tables / other fields.
  const { data: current } = await supabaseAdmin
    .from('manual_sections')
    .select('body_html_th, body_html_en, table_data')
    .eq('id', id)
    .single()

  const nextTableData = table_data
    ? { ...(current?.table_data ?? {}), ...sanitizeTableData(table_data) }
    : (current?.table_data ?? null)

  const { data, error } = await supabaseAdmin
    .from('manual_sections')
    .upsert({
      id,
      body_html_th: sanitizeRichHtml(body_html_th ?? current?.body_html_th ?? ''),
      body_html_en: sanitizeRichHtml(body_html_en ?? current?.body_html_en ?? ''),
      table_data: nextTableData,
      updated_at: new Date().toISOString(),
      updated_by: actor.id,
    })
    .select('id, body_html_th, body_html_en, table_data, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'manual_edit', user_id: actor.id, target: id,
    detail: `แก้ไขคู่มือ section: ${id}`,
  }).then(undefined, () => {})

  return NextResponse.json(data)
}
