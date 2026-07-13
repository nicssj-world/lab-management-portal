import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role, doc_role').eq('id', user.id).single()
  return data as { id: string; role: string; doc_role: string | null } | null
}

function canEdit(actor: { role: string; doc_role: string | null }) {
  const workflowRole = actor.doc_role ?? actor.role
  return actor.role === 'Admin' || [
    'Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer',
  ].includes(workflowRole)
}

// GET — list linked documents
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('document_links')
    .select('id, linked_doc_id, link_kind, set_mode, set_draft_id, created_by, created_at, documents!document_links_linked_doc_id_fkey(id, document_code, title, type, status, file_url, file_name, file_size)')
    .eq('document_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — link an existing document
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEdit(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { linked_doc_id } = await req.json()

  if (!linked_doc_id) return NextResponse.json({ error: 'Missing linked_doc_id' }, { status: 422 })
  if (linked_doc_id === id) return NextResponse.json({ error: 'ไม่สามารถลิงก์เอกสารตัวเองได้' }, { status: 422 })

  const { data, error } = await supabaseAdmin
    .from('document_links')
    .insert({ document_id: id, linked_doc_id, created_by: actor.id })
    .select('id, linked_doc_id, link_kind, set_mode, set_draft_id, created_by, created_at, documents!document_links_linked_doc_id_fkey(id, document_code, title, type, status, file_url, file_name, file_size)')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'เชื่อมโยงเอกสารนี้ไปแล้ว' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
