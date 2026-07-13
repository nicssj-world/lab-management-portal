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

function canDelete(actor: { id: string; role: string; doc_role: string | null }, createdBy: string | null) {
  if (['Admin', 'Manager'].includes(actor.role)) return true
  if (actor.doc_role === 'Document Controller') return true
  return actor.id === createdBy
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { linkId } = await params

  const { data: link } = await supabaseAdmin
    .from('document_links').select('id, created_by, link_kind').eq('id', linkId).single()

  if (!link) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
  if (link.link_kind === 'set') {
    return NextResponse.json({ error: 'ลิงก์สมาชิกชุดเอกสารไม่สามารถลบผ่านรายการเอกสารที่เกี่ยวข้องได้' }, { status: 409 })
  }
  if (!canDelete(actor, link.created_by)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabaseAdmin.from('document_links').delete().eq('id', linkId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
