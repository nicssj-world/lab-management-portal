import { NextRequest, NextResponse } from 'next/server'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  const canConfirm = actor.role === 'Admin'
    || actor.role === 'Document Controller'
    || actor.doc_role === 'Document Controller'
  if (!canConfirm) return jsonForbidden()

  const { id } = await params
  const currentResult = await supabaseAdmin
    .from('documents')
    .select('id, document_code, status, pending_file_url, pending_file_name, pending_file_size, pending_file_mime')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (currentResult.error) return NextResponse.json({ error: currentResult.error.message }, { status: 500 })
  const current = currentResult.data
  if (!current) return NextResponse.json({ error: 'ไม่พบเอกสาร' }, { status: 404 })
  if (!['Draft', 'Review'].includes(current.status)) {
    return NextResponse.json({ error: 'ยืนยันไฟล์ทางการได้เฉพาะเอกสารสถานะ Draft หรือ Review' }, { status: 409 })
  }
  if (!current.pending_file_url) {
    return NextResponse.json({ error: 'ไม่พบไฟล์ที่รอยืนยันเป็นไฟล์ทางการ' }, { status: 422 })
  }

  const updatedResult = await supabaseAdmin
    .from('documents')
    .update({
      file_url: current.pending_file_url,
      file_name: current.pending_file_name,
      file_size: current.pending_file_size,
      mime_type: current.pending_file_mime,
      pending_file_url: null,
      pending_file_name: null,
      pending_file_size: null,
      pending_file_mime: null,
    })
    .eq('id', id)
    .is('deleted_at', null)
    .in('status', ['Draft', 'Review'])
    .eq('pending_file_url', current.pending_file_url)
    .select()
    .maybeSingle()

  if (updatedResult.error) return NextResponse.json({ error: updatedResult.error.message }, { status: 500 })
  if (!updatedResult.data) {
    return NextResponse.json({ error: 'เอกสารถูกเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่' }, { status: 409 })
  }

  supabaseAdmin.from('audit_log').insert({
    action: 'document.official_confirm',
    user_id: actor.id,
    target: current.document_code ?? id,
    detail: current.pending_file_name ?? current.pending_file_url,
  }).then(undefined, () => {})

  return NextResponse.json(updatedResult.data)
}
