import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role, doc_role').eq('id', user.id).single()
  return data as { id: string; role: string; doc_role: string | null } | null
}

function canDelete(actor: { id: string; role: string; doc_role: string | null }, uploadedBy: string | null) {
  if (['Admin', 'Manager'].includes(actor.role)) return true
  if (actor.doc_role === 'Document Controller') return true
  return actor.id === uploadedBy
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; draftId: string; attachId: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { draftId, attachId } = await params

  const { data: attachment } = await supabaseAdmin
    .from('document_revision_draft_attachments')
    .select('id, file_url, uploaded_by')
    .eq('id', attachId)
    .eq('draft_id', draftId)
    .single()

  if (!attachment) return NextResponse.json({ error: 'ไม่พบไฟล์แนบ' }, { status: 404 })
  if (!canDelete(actor, attachment.uploaded_by)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Delete from R2
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: attachment.file_url }))
    .catch(() => {}) // non-fatal if already gone

  const { error } = await supabaseAdmin
    .from('document_revision_draft_attachments')
    .delete()
    .eq('id', attachId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
