import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isReviewOnlyType, reviewWindowState } from '@/lib/documents/review'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role, doc_role, name').eq('id', user.id).single()
  return data as { id: string; role: string; doc_role: string | null; name: string | null } | null
}

// Annual-review confirmation: a Reviewer/DCC/Admin attests that a Published QP/WI/Manual
// document has been reviewed and needs no content change. The document then queues in the
// pending page's "รอทบทวนประจำปี" section until the DCC bulk action bumps its revision.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const canConfirm = actor.role === 'Admin'
    || actor.role === 'Document Controller'
    || actor.doc_role === 'Document Controller'
    || actor.doc_role === 'Reviewer'
  if (!canConfirm) {
    return NextResponse.json({ error: 'เฉพาะ Reviewer, Document Controller หรือ Admin เท่านั้นที่ยืนยันการทบทวนได้' }, { status: 403 })
  }

  const { id } = await params
  const { data: doc, error } = await supabaseAdmin
    .from('documents')
    .select('id, document_code, type, status, edit_date, expiry_date, last_reviewed_at, review_confirmed_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error || !doc) return NextResponse.json({ error: 'ไม่พบเอกสาร' }, { status: 404 })

  if (doc.status !== 'Published') {
    return NextResponse.json({ error: 'ยืนยันการทบทวนได้เฉพาะเอกสารสถานะ Published' }, { status: 422 })
  }
  if (!isReviewOnlyType(doc.type)) {
    return NextResponse.json({ error: 'เอกสาร Manual (คู่มือ) ต้องทบทวนผ่าน Rev+ เท่านั้น — ปุ่มนี้ใช้กับ QP / WI' }, { status: 422 })
  }
  if (doc.review_confirmed_at) {
    return NextResponse.json({ error: 'เอกสารนี้ถูกยืนยันการทบทวนแล้ว รอ DCC ดำเนินการ' }, { status: 409 })
  }
  if (reviewWindowState(doc) === 'none') {
    return NextResponse.json({ error: 'เอกสารยังไม่เข้ารอบทบทวน (เข้ารอบเมื่อเหลือน้อยกว่า 90 วันก่อนครบกำหนด)' }, { status: 422 })
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('documents')
    .update({
      review_confirmed_at: new Date().toISOString(),
      review_confirmed_by: actor.id,
      review_confirmed_by_name: actor.name,
    })
    .eq('id', id)
    .select()
    .single()
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'document.review_confirmed',
    user_id: actor.id,
    target: doc.document_code ?? id,
    detail: `ยืนยันการทบทวนประจำปีโดย ${actor.name ?? actor.id}`,
  }).then(undefined, () => {})

  return NextResponse.json(updated)
}
