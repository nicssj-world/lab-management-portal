import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role, doc_role').eq('id', user.id).single()
  return data as { id: string; role: string; doc_role: string | null } | null
}

function canUploadAttachment(actor: { role: string; doc_role: string | null }) {
  const workflowRole = actor.doc_role ?? actor.role
  return actor.role === 'Admin' || [
    'Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer',
  ].includes(workflowRole)
}

// Returns the active (in-progress, unpublished) draft for the given id, or null
async function getActiveDraft(id: string, draftId: string) {
  const { data } = await supabaseAdmin
    .from('document_revision_drafts')
    .select('id, document_id, status, cancelled_at')
    .eq('id', draftId)
    .eq('document_id', id)
    .maybeSingle()
  return data as { id: string; document_id: string; status: string; cancelled_at: string | null } | null
}

// GET — list attachments for a revision draft
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; draftId: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { draftId } = await params

  const { data, error } = await supabaseAdmin
    .from('document_revision_draft_attachments')
    .select('id, file_url, file_name, file_size, mime_type, uploaded_by, created_at, profiles(name)')
    .eq('draft_id', draftId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — upload one or more attachment files to a revision draft
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; draftId: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canUploadAttachment(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, draftId } = await params

  const draft = await getActiveDraft(id, draftId)
  if (!draft) return NextResponse.json({ error: 'ไม่พบ working revision' }, { status: 404 })
  if (draft.cancelled_at || draft.status === 'Published') {
    return NextResponse.json({ error: 'ไม่สามารถแนบไฟล์ใน working revision นี้ได้' }, { status: 422 })
  }

  try {
    const form = await req.formData()
    const files = form.getAll('files') as File[]
    if (!files.length) return NextResponse.json({ error: 'ไม่มีไฟล์' }, { status: 422 })

    const inserted: unknown[] = []

    for (const file of files) {
      if (!file || file.size === 0) continue
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: `ไฟล์ ${file.name} ใหญ่เกิน 50 MB` }, { status: 422 })
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const key = `documents/draft-attachments/${draftId}/${Date.now()}-${safeName}`

      const buffer = Buffer.from(await file.arrayBuffer())
      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      }))

      const { data, error } = await supabaseAdmin
        .from('document_revision_draft_attachments')
        .insert({
          draft_id:     draftId,
          document_id:  id,
          file_url:     key,
          file_name:    file.name,
          file_size:    file.size,
          mime_type:    file.type || null,
          uploaded_by:  actor.id,
        })
        .select('id, file_url, file_name, file_size, mime_type, uploaded_by, created_at, profiles(name)')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      inserted.push(data)
    }

    return NextResponse.json(inserted, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
